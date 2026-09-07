#include "audio_pipeline.h"

#include "board_config.h"
#include "protocol/frame_codec.h"

#ifdef ESP_PLATFORM
#include "driver/gpio.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#endif

#include <algorithm>
#include <cstring>

namespace soba::audio {

#ifdef ESP_PLATFORM
namespace {
constexpr char kTag[] = "soba.audio";
constexpr i2s_port_t kMicPort = I2S_NUM_0;
constexpr i2s_port_t kSpeakerPort = I2S_NUM_1;
constexpr std::size_t kSpeakerDmaSamples = kPlaybackDmaSamples;
constexpr std::size_t kSpeakerMaxWriteCalls = kPlaybackMaxWriteCalls;
constexpr std::uint32_t kMicReadTimeoutMs = 30;
constexpr std::uint32_t kSpeakerWriteTimeoutMs = 20;
}
#endif

bool AudioPipeline::init() {
#ifdef ESP_PLATFORM
    if (!board::audio_pins_configured()) {
        ESP_LOGE(kTag, "audio GPIOs are unset; configure the board before enabling audio");
        return false;
    }

    const auto cleanup_channels = [this]() {
        if (speaker_tx_channel_ != nullptr) {
            (void)i2s_channel_disable(speaker_tx_channel_);
            (void)i2s_del_channel(speaker_tx_channel_);
            speaker_tx_channel_ = nullptr;
        }
        if (mic_rx_channel_ != nullptr) {
            (void)i2s_channel_disable(mic_rx_channel_);
            (void)i2s_del_channel(mic_rx_channel_);
            mic_rx_channel_ = nullptr;
        }
    };

    i2s_chan_config_t mic_channel_config =
        I2S_CHANNEL_DEFAULT_CONFIG(kMicPort, I2S_ROLE_MASTER);
    mic_channel_config.dma_desc_num = 8;
    mic_channel_config.dma_frame_num = kCaptureSamplesPerFrame;
    if (i2s_new_channel(&mic_channel_config, nullptr, &mic_rx_channel_) != ESP_OK) return false;

    i2s_std_config_t mic_config = {};
    mic_config.clk_cfg.sample_rate_hz = 16'000;
    mic_config.clk_cfg.clk_src = I2S_CLK_SRC_DEFAULT;
    mic_config.clk_cfg.mclk_multiple = I2S_MCLK_MULTIPLE_256;
    mic_config.clk_cfg.ext_clk_freq_hz = 0;
    mic_config.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT,
                                                                I2S_SLOT_MODE_MONO);
    mic_config.gpio_cfg = {
        .mclk = I2S_GPIO_UNUSED,
        .bclk = static_cast<gpio_num_t>(board::kMicBclkGpio),
        .ws = static_cast<gpio_num_t>(board::kMicWsGpio),
        .dout = I2S_GPIO_UNUSED,
        .din = static_cast<gpio_num_t>(board::kMicDataGpio),
        .invert_flags = {},
    };
    mic_config.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;
    if (i2s_channel_init_std_mode(mic_rx_channel_, &mic_config) != ESP_OK) {
        cleanup_channels();
        return false;
    }

    i2s_chan_config_t speaker_channel_config =
        I2S_CHANNEL_DEFAULT_CONFIG(kSpeakerPort, I2S_ROLE_MASTER);
    // Keep the hardware DMA window short. flush_playback() mutes the current
    // write, and the bounded write timeout below then lets the task stop
    // within the physical stop budget.
    speaker_channel_config.dma_desc_num = 4;
    speaker_channel_config.dma_frame_num = kSpeakerDmaSamples;
    speaker_channel_config.auto_clear = true;
    if (i2s_new_channel(&speaker_channel_config, &speaker_tx_channel_, nullptr) != ESP_OK) {
        cleanup_channels();
        return false;
    }

    i2s_std_config_t speaker_config = {};
    speaker_config.clk_cfg.sample_rate_hz = 24'000;
    speaker_config.clk_cfg.clk_src = I2S_CLK_SRC_DEFAULT;
    speaker_config.clk_cfg.mclk_multiple = I2S_MCLK_MULTIPLE_256;
    speaker_config.clk_cfg.ext_clk_freq_hz = 0;
    speaker_config.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT,
                                                                    I2S_SLOT_MODE_MONO);
    speaker_config.gpio_cfg = {
        .mclk = I2S_GPIO_UNUSED,
        .bclk = static_cast<gpio_num_t>(board::kSpeakerBclkGpio),
        .ws = static_cast<gpio_num_t>(board::kSpeakerWsGpio),
        .dout = static_cast<gpio_num_t>(board::kSpeakerDataGpio),
        .din = I2S_GPIO_UNUSED,
        .invert_flags = {},
    };
    speaker_config.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;
    if (i2s_channel_init_std_mode(speaker_tx_channel_, &speaker_config) != ESP_OK) {
        cleanup_channels();
        return false;
    }
    if (i2s_channel_enable(speaker_tx_channel_) != ESP_OK) {
        cleanup_channels();
        return false;
    }

    if (!allocate_queues()) {
        cleanup_channels();
        return false;
    }
    if (xTaskCreatePinnedToCore(capture_task_entry, "soba_capture", 4096, this, 5,
                                &capture_task_, 0) != pdPASS ||
        xTaskCreatePinnedToCore(playback_task_entry, "soba_playback", 4096, this, 5,
                                &playback_task_, 0) != pdPASS) {
        return false;
    }
    initialized_.store(true);
    return true;
#else
    initialized_.store(false);
    return false;
#endif
}

#ifdef ESP_PLATFORM
bool AudioPipeline::allocate_queues() {
    const std::size_t capture_bytes = sizeof(CaptureFrame) * kCaptureFrameCount;
    const std::size_t playback_bytes = sizeof(PlaybackFrame) * kPlaybackFrameCount;
    capture_queue_buffer_ = static_cast<std::uint8_t*>(
        heap_caps_calloc(1, capture_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    playback_queue_buffer_ = static_cast<std::uint8_t*>(
        heap_caps_calloc(1, playback_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (capture_queue_buffer_ == nullptr || playback_queue_buffer_ == nullptr) {
        ESP_LOGE(kTag, "PSRAM audio buffers unavailable; no full-session buffer is allocated");
        return false;
    }
    capture_queue_ = xQueueCreateStatic(kCaptureFrameCount, sizeof(CaptureFrame),
                                         capture_queue_buffer_, &capture_queue_storage_);
    playback_queue_ = xQueueCreateStatic(kPlaybackFrameCount, sizeof(PlaybackFrame),
                                          playback_queue_buffer_, &playback_queue_storage_);
    return capture_queue_ != nullptr && playback_queue_ != nullptr;
}

void AudioPipeline::capture_task_entry(void* context) {
    static_cast<AudioPipeline*>(context)->capture_task();
    vTaskDelete(nullptr);
}

void AudioPipeline::playback_task_entry(void* context) {
    static_cast<AudioPipeline*>(context)->playback_task();
    vTaskDelete(nullptr);
}

void AudioPipeline::capture_task() {
    std::array<std::int32_t, kCaptureSamplesPerFrame> raw{};
    while (true) {
        if (!capture_running_.load()) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }
        std::size_t bytes_read = 0;
        const esp_err_t err = i2s_channel_read(mic_rx_channel_, raw.data(), sizeof(raw),
                                               &bytes_read, kMicReadTimeoutMs);
        if (err != ESP_OK || bytes_read != sizeof(raw) || !capture_running_.load()) {
            continue;
        }
        CaptureFrame frame;
        for (std::size_t i = 0; i < kCaptureSamplesPerFrame; ++i) {
            frame.pcm[i] = protocol::convert_microphone_word(
                raw[i], static_cast<unsigned>(board::kMicSampleShift),
                static_cast<unsigned>(board::kMicSampleBits));
        }
        // A full queue is a hard bounded-buffer failure. Drop the frame rather
        // than block the I2S reader and grow latency without a limit.
        if (xQueueSend(capture_queue_, &frame, 0) != pdTRUE) {
            ESP_LOGW(kTag, "capture queue full; dropping one 20 ms frame");
        }
    }
}

void AudioPipeline::playback_task() {
    PlaybackFrame frame;
    while (true) {
        if (xQueueReceive(playback_queue_, &frame, pdMS_TO_TICKS(100)) != pdTRUE) continue;
        if (output_muted_.load() || frame.samples == 0) continue;
        std::size_t samples_written = 0;
        std::size_t write_calls = 0;
        while (samples_written < frame.samples && !output_muted_.load() &&
               write_calls < kSpeakerMaxWriteCalls) {
            const std::size_t requested_samples = std::min(
                kSpeakerDmaSamples, frame.samples - samples_written);
            const std::size_t requested_bytes = requested_samples * sizeof(std::int16_t);
            std::size_t bytes_written = 0;
            ++write_calls;
            const esp_err_t err = i2s_channel_write(
                speaker_tx_channel_, frame.pcm.data() + samples_written, requested_bytes,
                &bytes_written, kSpeakerWriteTimeoutMs);
            if (bytes_written > requested_bytes ||
                (bytes_written % sizeof(std::int16_t)) != 0) {
                ESP_LOGW(kTag, "speaker write returned an invalid byte count");
                break;
            }
            samples_written += bytes_written / sizeof(std::int16_t);
            if (bytes_written == 0 || (err != ESP_OK && samples_written == frame.samples)) {
                break;
            }
        }
        if (!output_muted_.load() && samples_written != frame.samples) {
            ESP_LOGW(kTag, "speaker write incomplete after bounded retries");
        }
    }
}
#endif

void AudioPipeline::start_capture() {
#ifdef ESP_PLATFORM
    if (!initialized_.load()) return;
    if (capture_running_.exchange(true)) return;
    xQueueReset(capture_queue_);
    (void)i2s_channel_enable(mic_rx_channel_);
#endif
}

void AudioPipeline::stop_capture() {
#ifdef ESP_PLATFORM
    const bool was_running = capture_running_.exchange(false);
    if (capture_queue_ != nullptr) xQueueReset(capture_queue_);
    if (was_running && initialized_.load()) (void)i2s_channel_disable(mic_rx_channel_);
#endif
}

bool AudioPipeline::read_capture(CaptureFrame* frame, std::uint32_t wait_ticks) {
#ifdef ESP_PLATFORM
    return frame != nullptr && capture_queue_ != nullptr &&
           xQueueReceive(capture_queue_, frame, wait_ticks) == pdTRUE;
#else
    (void)frame;
    (void)wait_ticks;
    return false;
#endif
}

bool AudioPipeline::enqueue_playback(const std::int16_t* pcm, std::size_t samples) {
#ifdef ESP_PLATFORM
    if (!initialized_.load() || pcm == nullptr || samples == 0 ||
        samples > kPlaybackSamplesPerFrame || output_muted_.load()) {
        return false;
    }
    PlaybackFrame frame;
    frame.samples = samples;
    std::memcpy(frame.pcm.data(), pcm, samples * sizeof(std::int16_t));
    return xQueueSend(playback_queue_, &frame, 0) == pdTRUE;
#else
    (void)pcm;
    (void)samples;
    return false;
#endif
}

void AudioPipeline::flush_playback() {
#ifdef ESP_PLATFORM
    output_muted_.store(true);
    if (playback_queue_ != nullptr) xQueueReset(playback_queue_);
#endif
}

void AudioPipeline::stop_all() {
    stop_capture();
    flush_playback();
}

void AudioPipeline::set_output_muted(bool muted) {
    output_muted_.store(muted);
    if (muted) flush_playback();
}

}  // namespace soba::audio
