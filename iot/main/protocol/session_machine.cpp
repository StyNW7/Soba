#include "session_machine.h"

#include <algorithm>

namespace soba::protocol {

namespace {
constexpr std::size_t kMaxEventIds = 256;
}

SessionMachine::SessionMachine() = default;

SessionAction SessionMachine::accepted(bool stop_capture, bool flush_playback) {
    return SessionAction{true, SessionError::kNone, stop_capture, flush_playback, false, false,
                         false};
}

SessionAction SessionMachine::rejected(SessionError error) {
    return SessionAction{false, error, false, false, false, false, false};
}

void SessionMachine::reset_for_reconnect(std::uint64_t now_ms) {
    phase_ = SessionPhase::kHandshake;
    session_id_.clear();
    clear_turn();
    started_at_ms_ = now_ms;
    event_order_.clear();
    event_ids_.clear();
}

SessionAction SessionMachine::accept_session_start(SessionMode mode, bool ticket_valid,
                                                   std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kHandshake || !ticket_valid) {
        return rejected(SessionError::kInvalidState);
    }
    mode_ = mode;
    started_at_ms_ = now_ms;
    return accepted();
}

SessionAction SessionMachine::accept_session_ready(const std::string& session_id,
                                                   std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kHandshake || session_id.empty()) {
        return rejected(SessionError::kInvalidState);
    }
    session_id_ = session_id;
    phase_ = SessionPhase::kReady;
    started_at_ms_ = now_ms;
    return accepted();
}

SessionAction SessionMachine::accept_input_ready(const std::string& session_id,
                                                 const std::string& turn_id,
                                                 const std::string& response_id,
                                                 std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kReady || !matches_session(session_id) ||
        turn_id.empty() || response_id.empty()) {
        return rejected(SessionError::kInvalidState);
    }
    turn_id_ = turn_id;
    response_id_ = response_id;
    phase_ = SessionPhase::kCapturing;
    turn_started_at_ms_ = now_ms;
    last_audio_at_ms_ = now_ms;
    next_input_sequence_ = 0;
    next_output_chunk_ = 0;
    turn_finalized_ = false;
    return accepted();
}

SessionAction SessionMachine::accept_audio(const std::uint8_t* data, std::size_t size,
                                           std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kCapturing || turn_finalized_) {
        return rejected(SessionError::kInvalidState);
    }
    InputFrameView frame;
    const FrameError error = decode_input_frame(data, size, next_input_sequence_, &frame);
    if (error != FrameError::kNone) {
        return rejected(error == FrameError::kSequenceGap ? SessionError::kSequenceGap
                                                           : SessionError::kInvalidAudio);
    }
    ++next_input_sequence_;
    last_audio_at_ms_ = now_ms;
    return accepted();
}

SessionAction SessionMachine::accept_input_end(const std::string& turn_id,
                                               std::uint32_t last_sequence,
                                               std::uint64_t now_ms) {
    if (session_id_.empty() || turn_id != turn_id_) {
        return rejected(SessionError::kInvalidState);
    }
    if (turn_finalized_) {
        return accepted(true);
    }
    if (phase_ != SessionPhase::kCapturing ||
        (next_input_sequence_ > 0 && last_sequence + 1U != next_input_sequence_)) {
        return rejected(SessionError::kSequenceGap);
    }
    last_audio_at_ms_ = now_ms;
    return accepted(true);
}

SessionAction SessionMachine::accept_transcript_final(const std::string& session_id,
                                                      const std::string& turn_id,
                                                      std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kCapturing || !matches_session(session_id) ||
        turn_id != turn_id_) {
        return rejected(SessionError::kInvalidState);
    }
    turn_finalized_ = true;
    phase_ = SessionPhase::kProcessing;
    last_audio_at_ms_ = now_ms;
    return accepted(true);
}

SessionAction SessionMachine::accept_response_start(const std::string& session_id,
                                                    const std::string& turn_id,
                                                    const std::string& response_id,
                                                    std::uint32_t response_sequence,
                                                    std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kProcessing || !matches_session(session_id) ||
        turn_id != turn_id_ || response_id != response_id_ || response_sequence == 0) {
        return rejected(SessionError::kInvalidState);
    }
    phase_ = SessionPhase::kSpeaking;
    response_sequence_ = response_sequence;
    next_output_chunk_ = 0;
    last_audio_at_ms_ = now_ms;
    return accepted(false, true);
}

SessionAction SessionMachine::accept_output(const std::uint8_t* data, std::size_t size,
                                            std::uint64_t now_ms) {
    if (phase_ != SessionPhase::kSpeaking) {
        return rejected(SessionError::kInvalidState);
    }
    OutputFrameView frame;
    const FrameError error = decode_output_frame(data, size, response_sequence_,
                                                 next_output_chunk_, &frame);
    if (error != FrameError::kNone) {
        return rejected(error == FrameError::kSequenceGap ? SessionError::kSequenceGap
                                                           : SessionError::kResponseMismatch);
    }
    ++next_output_chunk_;
    last_audio_at_ms_ = now_ms;
    return accepted();
}

SessionAction SessionMachine::accept_response_end(const std::string& response_id,
                                                   std::uint64_t /*now_ms*/) {
    if (response_id != response_id_) {
        return rejected(SessionError::kResponseMismatch);
    }
    if (phase_ == SessionPhase::kReady) {
        return accepted();
    }
    if (phase_ != SessionPhase::kSpeaking) {
        return rejected(SessionError::kInvalidState);
    }
    clear_turn();
    phase_ = SessionPhase::kReady;
    return accepted(false, true);
}

SessionAction SessionMachine::accept_response_cancel(const std::string& response_id,
                                                     std::uint64_t /*now_ms*/) {
    if (response_id != response_id_ ||
        (phase_ != SessionPhase::kProcessing && phase_ != SessionPhase::kSpeaking)) {
        return rejected(SessionError::kResponseMismatch);
    }
    clear_turn();
    phase_ = SessionPhase::kReady;
    return accepted(true, true);
}

SessionAction SessionMachine::accept_session_end(std::uint64_t /*now_ms*/) {
    if (phase_ == SessionPhase::kClosed || phase_ == SessionPhase::kHandshake) {
        return rejected(SessionError::kInvalidState);
    }
    const bool stop_capture = phase_ == SessionPhase::kCapturing;
    const bool flush = phase_ == SessionPhase::kSpeaking || phase_ == SessionPhase::kProcessing;
    phase_ = SessionPhase::kReview;
    clear_turn();
    return accepted(stop_capture, flush);
}

SessionAction SessionMachine::local_stop(std::uint64_t /*now_ms*/) {
    if (phase_ == SessionPhase::kClosed || phase_ == SessionPhase::kHandshake ||
        phase_ == SessionPhase::kReview) {
        return rejected(SessionError::kInvalidState);
    }
    const bool stop_capture = phase_ == SessionPhase::kCapturing;
    clear_turn();
    phase_ = SessionPhase::kReady;
    return accepted(stop_capture, true);
}

SessionAction SessionMachine::tick(std::uint64_t now_ms) {
    if (phase_ == SessionPhase::kClosed) {
        return rejected(SessionError::kInvalidState);
    }
    if (phase_ == SessionPhase::kHandshake &&
        now_ms - started_at_ms_ > kHandshakeTimeoutMs) {
        phase_ = SessionPhase::kClosed;
        return SessionAction{false, SessionError::kSessionExpired, false, true, true, true};
    }
    if (started_at_ms_ != 0 && now_ms - started_at_ms_ > kSessionTimeoutMs) {
        phase_ = SessionPhase::kClosed;
        return SessionAction{false, SessionError::kSessionExpired, true, true, true, true};
    }
    if (phase_ == SessionPhase::kCapturing && !turn_finalized_) {
        if (now_ms - turn_started_at_ms_ > kTurnTimeoutMs ||
            now_ms - last_audio_at_ms_ > kSilenceTimeoutMs) {
            turn_finalized_ = true;
            SessionAction action = accepted(true);
            action.send_input_end = true;
            return action;
        }
    }
    if (phase_ == SessionPhase::kSpeaking && now_ms - last_audio_at_ms_ > 5'000) {
        clear_turn();
        phase_ = SessionPhase::kReady;
        return SessionAction{false, SessionError::kBufferOverflow, false, true, false, true,
                             false};
    }
    return accepted();
}

bool SessionMachine::remember_event_id(const std::string& event_id) {
    if (event_id.empty() || event_ids_.find(event_id) != event_ids_.end()) {
        return false;
    }
    event_ids_.insert(event_id);
    event_order_.push_back(event_id);
    while (event_order_.size() > kMaxEventIds) {
        event_ids_.erase(event_order_.front());
        event_order_.pop_front();
    }
    return true;
}

bool SessionMachine::matches_session(const std::string& id) const {
    return !session_id_.empty() && id == session_id_;
}

void SessionMachine::clear_turn() {
    turn_id_.clear();
    response_id_.clear();
    next_input_sequence_ = 0;
    next_output_chunk_ = 0;
    response_sequence_ = 0;
    turn_finalized_ = false;
}

}  // namespace soba::protocol
