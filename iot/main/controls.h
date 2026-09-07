#pragma once

#include "protocol/state_machine.h"

#include <atomic>
#include <cstdint>

namespace soba::controls {

enum class Indicator { kOff, kCapturing, kConnecting, kError };

class PhysicalControlLogic final {
   public:
    static constexpr std::uint64_t kDebounceMs = 30;

    void update(bool mute_level_active, bool stop_level_active, std::uint64_t now_ms);
    void update(bool mute_level_active, bool stop_level_active, bool start_level_active,
                bool end_turn_level_active, std::uint64_t now_ms);
    bool microphone_muted() const { return microphone_muted_.load(); }
    bool capture_allowed() const { return !microphone_muted_.load(); }
    bool consume_stop_request();
    bool consume_start_request();
    bool consume_end_turn_request();
    bool stop_requested() const { return stop_latched_; }
    Indicator indicator() const { return indicator_.load(); }
    void set_indicator(Indicator value) { indicator_.store(value); }

   private:
    std::atomic<bool> microphone_muted_{false};
    bool stop_latched_ = false;
    bool start_latched_ = false;
    bool end_turn_latched_ = false;
    bool previous_stop_active_ = false;
    bool previous_start_active_ = false;
    bool previous_end_turn_active_ = false;
    std::uint64_t last_mute_change_ms_ = 0;
    std::uint64_t last_stop_change_ms_ = 0;
    std::uint64_t last_start_change_ms_ = 0;
    std::uint64_t last_end_turn_change_ms_ = 0;
    std::atomic<Indicator> indicator_{Indicator::kOff};
};

// Install GPIO inputs and the polled stop/mute path. Pins with value
// -1 are deliberately ignored; the firmware stays safe but reports that the
// corresponding hardware release gate is still open.
class HardwareControls final {
   public:
    bool init();
    void poll(std::uint64_t now_ms);
    bool microphone_muted() const { return logic_.microphone_muted(); }
    bool consume_stop_request() { return logic_.consume_stop_request(); }
    bool consume_start_request() { return logic_.consume_start_request(); }
    bool consume_end_turn_request() { return logic_.consume_end_turn_request(); }
    bool provision_button_active() const { return provision_button_active_; }
    void set_indicator(Indicator indicator);

   private:
    PhysicalControlLogic logic_;
    bool initialized_ = false;
    bool provision_button_active_ = false;
    std::uint64_t indicator_changed_ms_ = 0;
    Indicator last_indicator_ = Indicator::kOff;
};

}  // namespace soba::controls
