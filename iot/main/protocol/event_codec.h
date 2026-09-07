#pragma once

#include <cstddef>
#include <cstdint>
#include <string>

namespace soba::protocol {

std::string encode_session_start(const std::string& event_id, const std::string& ticket,
                                  const std::string& mode);
std::string encode_input_start(const std::string& event_id, const std::string& session_id,
                               const std::string& client_turn_id);
std::string encode_input_end(const std::string& event_id, const std::string& session_id,
                             const std::string& turn_id, std::uint32_t last_sequence);
std::string encode_response_cancel(const std::string& event_id, const std::string& session_id,
                                   const std::string& response_id);
std::string encode_session_end(const std::string& event_id, const std::string& session_id);
std::string encode_activity_control(const std::string& event_id,
                                     const std::string& session_id,
                                     const std::string& action);

// A strict small parser used before handing a JSON event to cJSON. It does not
// parse values and therefore cannot accidentally retain provider/user content.
bool event_type_is(const char* json, std::size_t length, const char* expected);

}  // namespace soba::protocol
