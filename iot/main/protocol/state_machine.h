#pragma once

#include <cstdint>
#include <mutex>

namespace soba::protocol {

enum class DeviceState {
    kUnprovisioned,
    kProvisioning,
    kConnecting,
    kIdle,
    kListening,
    kProcessing,
    kSpeaking,
    kOffline,
    kLocked,
};

enum class DeviceTransitionError { kNone, kInvalidState, kLocked };

struct DeviceTransition {
    bool accepted = false;
    DeviceTransitionError error = DeviceTransitionError::kNone;
};

class DeviceStateMachine final {
   public:
    DeviceTransition provision_started();
    DeviceTransition wifi_connected();
    DeviceTransition wifi_lost();
    DeviceTransition cloud_claimed();
    // End an unclaimed BLE window. A later physical action can start a new
    // provisioning window without carrying the old lifecycle state.
    DeviceTransition reset_provisioning();
    DeviceTransition start_listening();
    DeviceTransition start_processing();
    DeviceTransition start_speaking();
    DeviceTransition response_complete();
    DeviceTransition local_stop();
    DeviceTransition lock();
    DeviceTransition factory_reset();

    DeviceState state() const;

   private:
    DeviceTransition move(DeviceState next);
    DeviceState state_ = DeviceState::kUnprovisioned;
    mutable std::mutex mutex_;
};

}  // namespace soba::protocol
