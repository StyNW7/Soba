#include "audio_pipeline.h"
#include "controls.h"
#include "protocol/event_codec.h"
#include "protocol/frame_codec.h"
#include "protocol/session_machine.h"
#include "protocol/state_machine.h"

#include <array>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <string>

namespace {

void test_endian_and_microphone_conversion() {
    std::array<std::uint8_t, 4> value{};
    soba::protocol::write_be32(value.data(), 0x12345678U);
    assert(soba::protocol::read_be32(value.data()) == 0x12345678U);

    // A 24-bit +0x123456 sample left-aligned by eight bits.
    assert(soba::protocol::convert_microphone_word(0x12345600, 8, 24) == 0x1234);
    // Sign extension must preserve a negative waveform sample.
    assert(soba::protocol::convert_microphone_word(static_cast<std::int32_t>(0xff000000), 8, 24) < 0);

    std::array<std::uint8_t, soba::protocol::kInputFrameBytes> frame{};
    soba::protocol::write_be32(frame.data(), 0);
    soba::protocol::InputFrameView input{};
    assert(soba::protocol::decode_input_frame(frame.data(), frame.size(), 0, &input) ==
           soba::protocol::FrameError::kNone);
    assert(soba::protocol::decode_input_frame(frame.data(), frame.size() - 1, 1, &input) ==
           soba::protocol::FrameError::kInvalidSize);
    assert(soba::protocol::decode_input_frame(frame.data(), frame.size(), 1, &input) ==
           soba::protocol::FrameError::kSequenceGap);

    std::array<std::uint8_t, 12> output{};
    soba::protocol::write_be32(output.data(), 4);
    soba::protocol::write_be32(output.data() + 4, 0);
    soba::protocol::OutputFrameView decoded{};
    assert(soba::protocol::decode_output_frame(output.data(), output.size(), 4, 0, &decoded) ==
           soba::protocol::FrameError::kNone);
    assert(soba::protocol::decode_output_frame(output.data(), output.size(), 5, 0, &decoded) ==
           soba::protocol::FrameError::kResponseMismatch);
    assert(soba::protocol::decode_output_frame(output.data(), 11, 4, 0, &decoded) ==
           soba::protocol::FrameError::kOddPcmLength);
}

void test_session_flow_and_bounds() {
    soba::protocol::SessionMachine session;
    session.reset_for_reconnect(0);
    assert(session.accept_session_start(soba::protocol::SessionMode::kPrivate, true, 0).accepted);
    assert(session.accept_session_ready("session-1", 1).accepted);
    assert(session.accept_input_ready("session-1", "turn-1", "response-1", 2).accepted);

    std::array<std::uint8_t, soba::protocol::kInputFrameBytes> input{};
    soba::protocol::write_be32(input.data(), 0);
    assert(session.accept_audio(input.data(), input.size(), 3).accepted);
    assert(session.next_input_sequence() == 1);
    assert(!session.accept_audio(input.data(), input.size(), 4).accepted);
    assert(session.accept_input_end("turn-1", 0, 5).accepted);
    assert(session.accept_transcript_final("session-1", "turn-1", 6).accepted);
    assert(session.phase() == soba::protocol::SessionPhase::kProcessing);
    assert(session.accept_response_start("session-1", "turn-1", "response-1", 4, 7).accepted);

    std::array<std::uint8_t, 12> output{};
    soba::protocol::write_be32(output.data(), 4);
    soba::protocol::write_be32(output.data() + 4, 0);
    assert(session.accept_output(output.data(), output.size(), 8).accepted);
    soba::protocol::write_be32(output.data() + 4, 2);
    assert(!session.accept_output(output.data(), output.size(), 9).accepted);
    assert(session.accept_response_end("response-1", 10).accepted);
    assert(session.phase() == soba::protocol::SessionPhase::kReady);

    assert(session.remember_event_id("event-1"));
    assert(!session.remember_event_id("event-1"));
    session.reset_for_reconnect(11);
    assert(session.phase() == soba::protocol::SessionPhase::kHandshake);
    assert(session.session_id().empty());
    assert(session.next_input_sequence() == 0);
    assert(session.remember_event_id("event-1"));

    session.accept_session_start(soba::protocol::SessionMode::kPrivate, true, 12);
    assert(!session.tick(5'012).close_socket);  // exactly 5 s is still within the window
    assert(session.tick(5'013).close_socket);

    session.reset_for_reconnect(20);
    session.accept_session_start(soba::protocol::SessionMode::kPrivate, true, 20);
    session.accept_session_ready("session-2", 21);
    session.accept_input_ready("session-2", "turn-2", "response-2", 22);
    const auto silence = session.tick(15'023);
    assert(silence.stop_capture);  // 15 s without a payload
    assert(silence.send_input_end);
    assert(session.phase() == soba::protocol::SessionPhase::kCapturing);
}

void test_physical_controls_and_lifecycle() {
    soba::controls::PhysicalControlLogic controls;
    controls.update(false, false, 0);
    controls.update(true, false, 10);
    assert(!controls.microphone_muted());
    controls.update(true, false, 31);
    assert(controls.microphone_muted());
    controls.update(true, true, 62);
    assert(controls.stop_requested());
    assert(controls.consume_stop_request());
    assert(!controls.consume_stop_request());
    controls.update(false, false, false, false, 100);
    controls.update(false, false, true, false, 140);
    assert(controls.consume_start_request());
    controls.update(false, false, false, false, 180);
    controls.update(false, false, false, true, 220);
    assert(controls.consume_end_turn_request());

    soba::protocol::DeviceStateMachine device;
    assert(device.provision_started().accepted);
    assert(device.cloud_claimed().accepted);
    assert(device.wifi_connected().accepted);
    assert(device.start_listening().accepted);
    assert(device.start_processing().accepted);
    assert(device.start_speaking().accepted);
    assert(device.local_stop().accepted);
    assert(device.state() == soba::protocol::DeviceState::kIdle);
    assert(device.lock().accepted);
    assert(!device.start_listening().accepted);

    soba::protocol::DeviceStateMachine retry;
    assert(retry.provision_started().accepted);
    assert(retry.reset_provisioning().accepted);
    assert(retry.state() == soba::protocol::DeviceState::kUnprovisioned);
    assert(retry.provision_started().accepted);
}

void test_playback_frame_chunk_coverage() {
    assert(soba::audio::kPlaybackDmaSamples == 240);
    assert(soba::audio::kPlaybackSamplesPerFrame == 4800);
    assert(soba::audio::playback_chunk_count(0) == 0);
    assert(soba::audio::playback_chunk_count(1) == 1);
    assert(soba::audio::playback_chunk_count(soba::audio::kPlaybackDmaSamples) == 1);
    assert(soba::audio::playback_chunk_count(soba::audio::kPlaybackSamplesPerFrame) == 20);
    assert(soba::audio::kPlaybackMaxWriteCalls == 80);
    assert(soba::audio::kPlaybackFrameCount * soba::audio::kPlaybackSamplesPerFrame == 48'000);
}

void test_event_codec() {
    const std::string start = soba::protocol::encode_session_start(
        "event", "", "private");
    assert(start.find("\"sample_rate\":16000") != std::string::npos);
    assert(start.find("\"mode\":\"private\"") != std::string::npos);
    const std::string input = soba::protocol::encode_input_start("e", "s", "t");
    assert(soba::protocol::event_type_is(input.data(), input.size(), "input.start"));
    assert(!soba::protocol::event_type_is(input.data(), input.size(), "response.start"));
    const std::string escaped = soba::protocol::encode_activity_control("e", "s", "st\"op");
    assert(escaped.find("st\\\"op") != std::string::npos);
}

}  // namespace

int main() {
    test_endian_and_microphone_conversion();
    test_session_flow_and_bounds();
    test_physical_controls_and_lifecycle();
    test_playback_frame_chunk_coverage();
    test_event_codec();
    std::cout << "SOBA host protocol/state tests passed\n";
    return 0;
}
