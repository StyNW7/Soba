#include "frame_codec.h"

#include <algorithm>
#include <limits>

namespace soba::protocol {

void write_be32(std::uint8_t* destination, std::uint32_t value) {
    destination[0] = static_cast<std::uint8_t>((value >> 24) & 0xffU);
    destination[1] = static_cast<std::uint8_t>((value >> 16) & 0xffU);
    destination[2] = static_cast<std::uint8_t>((value >> 8) & 0xffU);
    destination[3] = static_cast<std::uint8_t>(value & 0xffU);
}

std::uint32_t read_be32(const std::uint8_t* source) {
    return (static_cast<std::uint32_t>(source[0]) << 24) |
           (static_cast<std::uint32_t>(source[1]) << 16) |
           (static_cast<std::uint32_t>(source[2]) << 8) |
           static_cast<std::uint32_t>(source[3]);
}

FrameError decode_input_frame(const std::uint8_t* data, std::size_t size,
                              std::uint32_t expected_sequence,
                              InputFrameView* output) {
    if (data == nullptr || output == nullptr || size != kInputFrameBytes) {
        return FrameError::kInvalidSize;
    }
    const std::uint32_t sequence = read_be32(data);
    if (sequence != expected_sequence) {
        return sequence < expected_sequence ? FrameError::kSequenceGap
                                             : FrameError::kInvalidSequence;
    }
    output->sequence = sequence;
    output->pcm = data + 4;
    output->pcm_bytes = kInputPcmBytes;
    return FrameError::kNone;
}

FrameError decode_output_frame(const std::uint8_t* data, std::size_t size,
                               std::uint32_t expected_response_sequence,
                               std::uint32_t expected_chunk_sequence,
                               OutputFrameView* output) {
    if (data == nullptr || output == nullptr ||
        size < kOutputFrameHeaderBytes ||
        size > kOutputFrameHeaderBytes + kOutputPcmBytesMax) {
        return FrameError::kInvalidSize;
    }
    const std::size_t pcm_bytes = size - kOutputFrameHeaderBytes;
    if ((pcm_bytes & 1U) != 0U) {
        return FrameError::kOddPcmLength;
    }
    const std::uint32_t response_sequence = read_be32(data);
    const std::uint32_t chunk_sequence = read_be32(data + 4);
    if (response_sequence != expected_response_sequence) {
        return FrameError::kResponseMismatch;
    }
    if (chunk_sequence != expected_chunk_sequence) {
        return chunk_sequence < expected_chunk_sequence ? FrameError::kSequenceGap
                                                         : FrameError::kInvalidSequence;
    }
    output->response_sequence = response_sequence;
    output->chunk_sequence = chunk_sequence;
    output->pcm = data + kOutputFrameHeaderBytes;
    output->pcm_bytes = pcm_bytes;
    return FrameError::kNone;
}

std::int16_t convert_microphone_word(std::int32_t raw, unsigned shift,
                                     unsigned bits) {
    if (bits == 0 || bits > 31 || shift > 31) {
        return 0;
    }

    // The right shift is intentional: ESP I2S supplies a signed word with the
    // microphone sample left-aligned. Masking after the shift makes sign
    // extension explicit and avoids implementation-specific unsigned casts.
    const std::int32_t shifted = raw >> shift;
    const std::uint32_t mask = (1U << bits) - 1U;
    std::uint32_t value = static_cast<std::uint32_t>(shifted) & mask;
    const std::uint32_t sign_bit = 1U << (bits - 1U);
    if ((value & sign_bit) != 0U) {
        value |= ~mask;
    }
    std::int64_t sample = static_cast<std::int32_t>(value);
    if (bits > 16) {
        sample >>= (bits - 16U);
    } else {
        sample <<= (16U - bits);
    }
    sample = std::clamp<std::int64_t>(sample, std::numeric_limits<std::int16_t>::min(),
                                      std::numeric_limits<std::int16_t>::max());
    return static_cast<std::int16_t>(sample);
}

}  // namespace soba::protocol
