#pragma once

#include "frame_codec.h"

#include <cstdint>
#include <deque>
#include <string>
#include <unordered_set>

namespace soba::protocol {

enum class SessionPhase {
    kHandshake,
    kReady,
    kCapturing,
    kProcessing,
    kSpeaking,
    kReview,
    kClosed,
};

enum class SessionMode { kPrivate, kPersonal };

enum class SessionError {
    kNone,
    kInvalidState,
    kInvalidAudio,
    kSequenceGap,
    kBufferOverflow,
    kSessionExpired,
    kResponseMismatch,
};

struct SessionAction {
    bool accepted = false;
    SessionError error = SessionError::kNone;
    bool stop_capture = false;
    bool flush_playback = false;
    bool close_socket = false;
    bool discard_audio = false;
    bool send_input_end = false;
};

class SessionMachine final {
   public:
    static constexpr std::uint64_t kHandshakeTimeoutMs = 5'000;
    static constexpr std::uint64_t kTurnTimeoutMs = 120'000;
    static constexpr std::uint64_t kSilenceTimeoutMs = 15'000;
    static constexpr std::uint64_t kSessionTimeoutMs = 1'800'000;

    SessionMachine();

    void reset_for_reconnect(std::uint64_t now_ms);
    SessionAction accept_session_start(SessionMode mode, bool ticket_valid,
                                       std::uint64_t now_ms);
    SessionAction accept_session_ready(const std::string& session_id,
                                       std::uint64_t now_ms);
    SessionAction accept_input_ready(const std::string& session_id,
                                     const std::string& turn_id,
                                     const std::string& response_id,
                                     std::uint64_t now_ms);
    SessionAction accept_audio(const std::uint8_t* data, std::size_t size,
                               std::uint64_t now_ms);
    SessionAction accept_input_end(const std::string& turn_id,
                                   std::uint32_t last_sequence,
                                   std::uint64_t now_ms);
    SessionAction accept_transcript_final(const std::string& session_id,
                                          const std::string& turn_id,
                                          std::uint64_t now_ms);
    SessionAction accept_response_start(const std::string& session_id,
                                        const std::string& turn_id,
                                        const std::string& response_id,
                                        std::uint32_t response_sequence,
                                        std::uint64_t now_ms);
    SessionAction accept_output(const std::uint8_t* data, std::size_t size,
                                std::uint64_t now_ms);
    SessionAction accept_response_end(const std::string& response_id,
                                      std::uint64_t now_ms);
    SessionAction accept_response_cancel(const std::string& response_id,
                                         std::uint64_t now_ms);
    SessionAction accept_session_end(std::uint64_t now_ms);
    SessionAction local_stop(std::uint64_t now_ms);
    SessionAction tick(std::uint64_t now_ms);

    bool remember_event_id(const std::string& event_id);
    SessionPhase phase() const { return phase_; }
    const std::string& session_id() const { return session_id_; }
    const std::string& turn_id() const { return turn_id_; }
    const std::string& response_id() const { return response_id_; }
    std::uint32_t next_input_sequence() const { return next_input_sequence_; }
    std::uint32_t next_output_chunk() const { return next_output_chunk_; }
    bool turn_finalized() const { return turn_finalized_; }

   private:
    SessionAction accepted(bool stop_capture = false, bool flush_playback = false);
    SessionAction rejected(SessionError error);
    bool matches_session(const std::string& id) const;
    void clear_turn();

    SessionPhase phase_ = SessionPhase::kHandshake;
    SessionMode mode_ = SessionMode::kPrivate;
    std::string session_id_;
    std::string turn_id_;
    std::string response_id_;
    std::uint64_t started_at_ms_ = 0;
    std::uint64_t turn_started_at_ms_ = 0;
    std::uint64_t last_audio_at_ms_ = 0;
    std::uint32_t next_input_sequence_ = 0;
    std::uint32_t next_output_chunk_ = 0;
    std::uint32_t response_sequence_ = 0;
    bool turn_finalized_ = false;
    std::deque<std::string> event_order_;
    std::unordered_set<std::string> event_ids_;
};

}  // namespace soba::protocol
