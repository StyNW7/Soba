#pragma once

#include <cstddef>
#include <cstdint>

namespace soba::protocol {

constexpr std::size_t kInputPcmBytes = 640;       // 20 ms, 16 kHz, mono S16LE
constexpr std::size_t kOutputPcmBytesMax = 9600;  // 200 ms, 24 kHz, mono S16LE
constexpr std::size_t kInputFrameBytes = 4 + kInputPcmBytes;
constexpr std::size_t kOutputFrameHeaderBytes = 8;

enum class FrameError {
    kNone,
    kInvalidSize,
    kInvalidSequence,
    kSequenceGap,
    kOddPcmLength,
    kResponseMismatch,
};

struct InputFrameView {
    std::uint32_t sequence = 0;
    const std::uint8_t* pcm = nullptr;
    std::size_t pcm_bytes = 0;
};

struct OutputFrameView {
    std::uint32_t response_sequence = 0;
    std::uint32_t chunk_sequence = 0;
    const std::uint8_t* pcm = nullptr;
    std::size_t pcm_bytes = 0;
};

FrameError decode_input_frame(const std::uint8_t* data, std::size_t size,
                              std::uint32_t expected_sequence,
                              InputFrameView* output);

FrameError decode_output_frame(const std::uint8_t* data, std::size_t size,
                               std::uint32_t expected_response_sequence,
                               std::uint32_t expected_chunk_sequence,
                               OutputFrameView* output);

void write_be32(std::uint8_t* destination, std::uint32_t value);
std::uint32_t read_be32(const std::uint8_t* source);

// Convert a signed microphone word to the signed 16-bit PCM used by SOBA.
// `shift` and `bits` are board/microphone properties and must be measured for
// the selected microphone. The function sign-extends before reducing width.
std::int16_t convert_microphone_word(std::int32_t raw, unsigned shift,
                                     unsigned bits);

}  // namespace soba::protocol
