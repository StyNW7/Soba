#pragma once

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>

#ifdef ESP_PLATFORM
#include "driver/i2s_std.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#endif

namespace soba::audio {

constexpr std::size_t kCaptureSamplesPerFrame = 320;   // 20 ms at 16 kHz
constexpr std::size_t kPlaybackDmaSamples = 240;       // 10 ms at 24 kHz
constexpr std::size_t kPlaybackSamplesPerFrame = 4800; // maximum 200 ms output frame
constexpr std::size_t kCaptureFrameCount = 100;        // exactly two seconds
constexpr std::size_t kPlaybackFrameCount = 10;        // exactly two seconds at maximum frame size

constexpr std::size_t playback_chunk_count(std::size_t samples) {
    return samples == 0 ? 0 : (samples + kPlaybackDmaSamples - 1) / kPlaybackDmaSamples;
}

// One full write plus up to three partial-write retries per DMA chunk.
constexpr std::size_t kPlaybackMaxWriteCalls = playback_chunk_count(kPlaybackSamplesPerFrame) * 4;

struct CaptureFrame {
    std::array<std::int16_t, kCaptureSamplesPerFrame> pcm{};
};

struct PlaybackFrame {
    std::array<std::int16_t, kPlaybackSamplesPerFrame> pcm{};
    std::size_t samples = 0;
};

class AudioPipeline final {
   public:
    bool init();
    void start_capture();
    void stop_capture();
    bool read_capture(CaptureFrame* frame, std::uint32_t wait_ticks);
    bool enqueue_playback(const std::int16_t* pcm, std::size_t samples);
    void flush_playback();
    void stop_all();
    bool is_capture_running() const { return capture_running_.load(); }
    bool is_output_muted() const { return output_muted_.load(); }
    void set_output_muted(bool muted);
    bool healthy() const { return initialized_.load(); }

   private:
#ifdef ESP_PLATFORM
    static void capture_task_entry(void* context);
    static void playback_task_entry(void* context);
    void capture_task();
    void playback_task();
    bool allocate_queues();

    i2s_chan_handle_t mic_rx_channel_ = nullptr;
    i2s_chan_handle_t speaker_tx_channel_ = nullptr;
    QueueHandle_t capture_queue_ = nullptr;
    QueueHandle_t playback_queue_ = nullptr;
    StaticQueue_t capture_queue_storage_{};
    StaticQueue_t playback_queue_storage_{};
    std::uint8_t* capture_queue_buffer_ = nullptr;
    std::uint8_t* playback_queue_buffer_ = nullptr;
    TaskHandle_t capture_task_ = nullptr;
    TaskHandle_t playback_task_ = nullptr;
#endif
    std::atomic<bool> initialized_{false};
    std::atomic<bool> capture_running_{false};
    std::atomic<bool> output_muted_{true};
};

}  // namespace soba::audio
