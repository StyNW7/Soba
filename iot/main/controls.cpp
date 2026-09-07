#include "controls.h"

#include "board_config.h"

#include <algorithm>

#ifdef ESP_PLATFORM
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#endif

namespace soba::controls {

void PhysicalControlLogic::update(bool mute_level_active, bool stop_level_active,
                                  std::uint64_t now_ms) {
    update(mute_level_active, stop_level_active, false, false, now_ms);
}

void PhysicalControlLogic::update(bool mute_level_active, bool stop_level_active,
                                  bool start_level_active, bool end_turn_level_active,
                                  std::uint64_t now_ms) {
    if (mute_level_active != microphone_muted_.load() &&
        now_ms - last_mute_change_ms_ >= kDebounceMs) {
        microphone_muted_ = mute_level_active;
        last_mute_change_ms_ = now_ms;
    }
    if (stop_level_active && !previous_stop_active_ &&
        now_ms - last_stop_change_ms_ >= kDebounceMs) {
        stop_latched_ = true;
        last_stop_change_ms_ = now_ms;
    }
    if (start_level_active && !previous_start_active_ &&
        now_ms - last_start_change_ms_ >= kDebounceMs) {
        start_latched_ = true;
        last_start_change_ms_ = now_ms;
    }
    if (end_turn_level_active && !previous_end_turn_active_ &&
        now_ms - last_end_turn_change_ms_ >= kDebounceMs) {
        end_turn_latched_ = true;
        last_end_turn_change_ms_ = now_ms;
    }
    previous_stop_active_ = stop_level_active;
    previous_start_active_ = start_level_active;
    previous_end_turn_active_ = end_turn_level_active;
}

bool PhysicalControlLogic::consume_stop_request() {
    const bool requested = stop_latched_;
    stop_latched_ = false;
    return requested;
}

bool PhysicalControlLogic::consume_start_request() {
    const bool requested = start_latched_;
    start_latched_ = false;
    return requested;
}

bool PhysicalControlLogic::consume_end_turn_request() {
    const bool requested = end_turn_latched_;
    end_turn_latched_ = false;
    return requested;
}

bool HardwareControls::init() {
#ifdef ESP_PLATFORM
    gpio_config_t input = {};
    input.intr_type = GPIO_INTR_DISABLE;
    input.mode = GPIO_MODE_INPUT;
    input.pin_bit_mask = 0;
    input.pull_up_en = GPIO_PULLUP_ENABLE;
    input.pull_down_en = GPIO_PULLDOWN_DISABLE;
    for (const int pin : {board::kMicMuteGpio, board::kStopGpio, board::kStartGpio,
                          board::kEndTurnGpio, board::kProvisionButtonGpio}) {
        if (pin >= 0) input.pin_bit_mask |= (1ULL << pin);
    }
    if (input.pin_bit_mask != 0) {
        if (gpio_config(&input) != ESP_OK) {
            ESP_LOGE("soba.controls", "GPIO input setup failed");
            return false;
        }
    }
    if constexpr (board::kStatusLedGpio >= 0) {
        gpio_config_t led = {};
        led.intr_type = GPIO_INTR_DISABLE;
        led.mode = GPIO_MODE_OUTPUT;
        led.pin_bit_mask = 1ULL << board::kStatusLedGpio;
        led.pull_up_en = GPIO_PULLUP_DISABLE;
        led.pull_down_en = GPIO_PULLDOWN_DISABLE;
        if (gpio_config(&led) != ESP_OK) return false;
        gpio_set_level(static_cast<gpio_num_t>(board::kStatusLedGpio), 0);
    }
    initialized_ = true;
    if (board::kMicMuteGpio < 0 || board::kStopGpio < 0 || board::kStartGpio < 0) {
        ESP_LOGW("soba.controls", "mute/stop/start hardware pin is not configured");
    }
    return true;
#else
    initialized_ = true;
    return true;
#endif
}

void HardwareControls::poll(std::uint64_t now_ms) {
    if (!initialized_) return;
    bool muted = false;
    bool stopped = false;
    bool started = false;
    bool end_turn = false;
#ifdef ESP_PLATFORM
    if (board::kMicMuteGpio >= 0) {
        muted = gpio_get_level(static_cast<gpio_num_t>(board::kMicMuteGpio)) ==
                board::kMicActiveLevel;
    }
    if (board::kStopGpio >= 0) {
        stopped = gpio_get_level(static_cast<gpio_num_t>(board::kStopGpio)) ==
                  board::kStopActiveLevel;
    }
    if (board::kStartGpio >= 0) {
        started = gpio_get_level(static_cast<gpio_num_t>(board::kStartGpio)) ==
                  board::kStartActiveLevel;
    }
    if (board::kEndTurnGpio >= 0) {
        end_turn = gpio_get_level(static_cast<gpio_num_t>(board::kEndTurnGpio)) ==
                   board::kEndTurnActiveLevel;
    }
    if (board::kProvisionButtonGpio >= 0) {
        provision_button_active_ =
            gpio_get_level(static_cast<gpio_num_t>(board::kProvisionButtonGpio)) ==
            board::kProvisionActiveLevel;
    }
#endif
    logic_.update(muted, stopped, started, end_turn, now_ms);
    if (logic_.indicator() != last_indicator_) {
        indicator_changed_ms_ = now_ms;
        last_indicator_ = logic_.indicator();
    }
#ifdef ESP_PLATFORM
    if (board::kStatusLedGpio >= 0) {
        const auto pin = static_cast<gpio_num_t>(board::kStatusLedGpio);
        bool on = false;
        switch (logic_.indicator()) {
            case Indicator::kOff: on = false; break;
            case Indicator::kCapturing: on = true; break;
            case Indicator::kConnecting: on = ((now_ms / 500U) & 1U) == 0U; break;
            case Indicator::kError: {
                const std::uint64_t elapsed = now_ms - indicator_changed_ms_;
                const std::uint64_t phase = elapsed % 1'200U;
                on = phase < 120U || (phase >= 240U && phase < 360U);
                break;
            }
        }
        gpio_set_level(pin, on ? 1 : 0);
    }
#endif
}

void HardwareControls::set_indicator(Indicator indicator) {
    logic_.set_indicator(indicator);
#ifdef ESP_PLATFORM
    if (board::kStatusLedGpio < 0) return;
    const auto pin = static_cast<gpio_num_t>(board::kStatusLedGpio);
    // Timing is handled by the 10 ms poll loop. The LED is deliberately a
    // single unambiguous indicator; color is not used as a requirement.
    gpio_set_level(pin, indicator == Indicator::kCapturing ? 1 : 0);
#else
    (void)indicator;
#endif
}

}  // namespace soba::controls
