#pragma once

#include "preferences_store.h"

#include <cstdint>
#include <functional>

namespace soba::telemetry {

class DeviceTelemetry final {
   public:
    explicit DeviceTelemetry(storage::PreferencesStore& storage);
    bool init();
    void tick(std::uint64_t now_ms);
    void set_battery_reader(std::function<bool(std::uint8_t*)> reader);
    bool ready() const { return initialized_; }

   private:
    bool send_heartbeat(std::uint8_t battery_percent);
    storage::PreferencesStore& storage_;
    std::function<bool(std::uint8_t*)> battery_reader_;
    std::uint64_t next_heartbeat_ms_ = 0;
    bool initialized_ = false;
};

}  // namespace soba::telemetry
