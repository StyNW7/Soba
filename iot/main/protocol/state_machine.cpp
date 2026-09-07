#include "state_machine.h"

namespace soba::protocol {

DeviceTransition DeviceStateMachine::move(DeviceState next) {
    if (state_ == DeviceState::kLocked && next != DeviceState::kLocked) {
        return {false, DeviceTransitionError::kLocked};
    }
    state_ = next;
    return {true, DeviceTransitionError::kNone};
}

DeviceTransition DeviceStateMachine::provision_started() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kUnprovisioned) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kProvisioning);
}

DeviceTransition DeviceStateMachine::wifi_connected() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kConnecting && state_ != DeviceState::kOffline &&
        state_ != DeviceState::kProvisioning) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kIdle);
}

DeviceTransition DeviceStateMachine::wifi_lost() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ == DeviceState::kLocked || state_ == DeviceState::kUnprovisioned) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kOffline);
}

DeviceTransition DeviceStateMachine::cloud_claimed() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kProvisioning && state_ != DeviceState::kConnecting) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kConnecting);
}

DeviceTransition DeviceStateMachine::reset_provisioning() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ == DeviceState::kLocked) {
        return {false, DeviceTransitionError::kLocked};
    }
    if (state_ != DeviceState::kUnprovisioned && state_ != DeviceState::kProvisioning &&
        state_ != DeviceState::kIdle && state_ != DeviceState::kOffline) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kUnprovisioned);
}

DeviceTransition DeviceStateMachine::start_listening() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kIdle) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kListening);
}

DeviceTransition DeviceStateMachine::start_processing() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kListening) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kProcessing);
}

DeviceTransition DeviceStateMachine::start_speaking() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kProcessing) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kSpeaking);
}

DeviceTransition DeviceStateMachine::response_complete() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kSpeaking && state_ != DeviceState::kProcessing) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kIdle);
}

DeviceTransition DeviceStateMachine::local_stop() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ != DeviceState::kListening && state_ != DeviceState::kProcessing &&
        state_ != DeviceState::kSpeaking) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kIdle);
}

DeviceTransition DeviceStateMachine::lock() {
    std::lock_guard<std::mutex> guard(mutex_);
    return move(DeviceState::kLocked);
}

DeviceTransition DeviceStateMachine::factory_reset() {
    std::lock_guard<std::mutex> guard(mutex_);
    if (state_ == DeviceState::kLocked || state_ != DeviceState::kUnprovisioned) {
        return {false, DeviceTransitionError::kInvalidState};
    }
    return move(DeviceState::kUnprovisioned);
}

DeviceState DeviceStateMachine::state() const {
    std::lock_guard<std::mutex> guard(mutex_);
    return state_;
}

}  // namespace soba::protocol
