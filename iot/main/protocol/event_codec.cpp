#include "event_codec.h"

#include <cctype>

namespace soba::protocol {

namespace {
std::string escape_json(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 2);
    for (const unsigned char c : value) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20U) {
                    out += "\\u00";
                    constexpr char hex[] = "0123456789abcdef";
                    out += hex[c >> 4];
                    out += hex[c & 0x0fU];
                } else {
                    out.push_back(static_cast<char>(c));
                }
        }
    }
    return out;
}

std::string quote(const std::string& value) { return "\"" + escape_json(value) + "\""; }

std::string base(const char* type, const std::string& event_id) {
    return std::string("{\"type\":") + quote(type) +
           ",\"version\":1,\"event_id\":" + quote(event_id);
}
}

std::string encode_session_start(const std::string& event_id, const std::string& ticket,
                                 const std::string& mode) {
    return base("session.start", event_id) + ",\"ticket\":" + quote(ticket) +
           ",\"sample_rate\":16000,\"encoding\":\"pcm_s16le\",\"channels\":1,\"mode\":" +
           quote(mode) + "}";
}

std::string encode_input_start(const std::string& event_id, const std::string& session_id,
                               const std::string& client_turn_id) {
    return base("input.start", event_id) + ",\"session_id\":" + quote(session_id) +
           ",\"client_turn_id\":" + quote(client_turn_id) + "}";
}

std::string encode_input_end(const std::string& event_id, const std::string& session_id,
                             const std::string& turn_id, std::uint32_t last_sequence) {
    return base("input.end", event_id) + ",\"session_id\":" + quote(session_id) +
           ",\"turn_id\":" + quote(turn_id) + ",\"last_sequence\":" +
           std::to_string(last_sequence) + "}";
}

std::string encode_response_cancel(const std::string& event_id, const std::string& session_id,
                                   const std::string& response_id) {
    return base("response.cancel", event_id) + ",\"session_id\":" + quote(session_id) +
           ",\"response_id\":" + quote(response_id) + "}";
}

std::string encode_session_end(const std::string& event_id, const std::string& session_id) {
    return base("session.end", event_id) + ",\"session_id\":" + quote(session_id) + "}";
}

std::string encode_activity_control(const std::string& event_id,
                                     const std::string& session_id,
                                     const std::string& action) {
    return base("activity.control", event_id) + ",\"session_id\":" + quote(session_id) +
           ",\"action\":" + quote(action) + "}";
}

bool event_type_is(const char* json, std::size_t length, const char* expected) {
    if (json == nullptr || expected == nullptr) return false;
    const std::string needle = std::string("\"type\":\"") + expected + "\"";
    for (std::size_t i = 0; i + needle.size() <= length; ++i) {
        bool match = true;
        for (std::size_t j = 0; j < needle.size(); ++j) {
            if (json[i + j] != needle[j]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

}  // namespace soba::protocol
