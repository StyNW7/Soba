#include "transport_client.h"

#include "board_config.h"
#include "protocol/event_codec.h"
#include "protocol/frame_codec.h"

#ifdef ESP_PLATFORM
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "esp_transport_ws.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#endif

#include <algorithm>
#include <cstdio>
#include <cstring>

namespace soba::transport {

namespace {
constexpr char kTag[] = "soba.transport";
constexpr std::size_t kMaxJsonFrame = 16 * 1024;

#ifdef ESP_PLATFORM
std::uint64_t monotonic_ms() {
    return static_cast<std::uint64_t>(esp_timer_get_time() / 1000);
}

const char* string_field(const cJSON* root, const char* name) {
    const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, name);
    return cJSON_IsString(value) ? value->valuestring : nullptr;
}

#endif
}

TransportClient::TransportClient(audio::AudioPipeline& audio,
                                 controls::HardwareControls& controls,
                                 storage::PreferencesStore& storage,
                                 TransportCallbacks callbacks)
    : audio_(audio), controls_(controls), storage_(storage), callbacks_(std::move(callbacks)) {
#ifdef ESP_PLATFORM
    mutex_ = xSemaphoreCreateRecursiveMutex();
#endif
}

TransportClient::~TransportClient() {
    disconnect();
#ifdef ESP_PLATFORM
    if (mutex_ != nullptr) vSemaphoreDelete(mutex_);
#endif
}

protocol::SessionPhase TransportClient::phase() const {
#ifdef ESP_PLATFORM
    lock();
    const protocol::SessionPhase result = machine_.phase();
    unlock();
    return result;
#else
    return machine_.phase();
#endif
}

#ifdef ESP_PLATFORM
void TransportClient::lock() const {
    if (mutex_ != nullptr) (void)xSemaphoreTakeRecursive(mutex_, portMAX_DELAY);
}

void TransportClient::unlock() const {
    if (mutex_ != nullptr) (void)xSemaphoreGiveRecursive(mutex_);
}
#endif

bool TransportClient::init() {
#ifdef ESP_PLATFORM
    lock();
    token_ = storage_.operational_token();
    if (token_.empty()) {
        ESP_LOGW(kTag, "operational credential is absent; provisioning is required");
        unlock();
        return false;
    }
    uri_ = CONFIG_SOBA_API_URI;
    if (uri_.rfind("wss://", 0) != 0) {
        ESP_LOGE(kTag, "voice endpoint must use wss://");
        unlock();
        return false;
    }
    auth_header_ = "Authorization: Bearer " + token_;
    initialized_ = true;
    unlock();
    return true;
#else
    return false;
#endif
}

bool TransportClient::connect() {
#ifdef ESP_PLATFORM
    lock();
    if (!initialized_ || connected_.load()) {
        const bool result = connected_.load();
        unlock();
        return result;
    }
    disconnect_requested_.store(false);
    closing_.store(false);
    machine_.reset_for_reconnect(monotonic_ms());
    audio_.stop_all();
    esp_websocket_client_config_t config = {};
    config.uri = uri_.c_str();
    config.headers = auth_header_.c_str();
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.disable_auto_reconnect = true;
    websocket_ = esp_websocket_client_init(&config);
    if (websocket_ == nullptr) {
        unlock();
        return false;
    }
    if (esp_websocket_register_events(websocket_, WEBSOCKET_EVENT_ANY, websocket_event, this) !=
        ESP_OK) {
        esp_websocket_client_destroy(websocket_);
        websocket_ = nullptr;
        unlock();
        return false;
    }
    if (esp_websocket_client_start(websocket_) != ESP_OK) {
        esp_websocket_client_destroy(websocket_);
        websocket_ = nullptr;
        unlock();
        return false;
    }
    unlock();
    return true;
#else
    return false;
#endif
}

void TransportClient::disconnect() {
#ifdef ESP_PLATFORM
    esp_websocket_client_handle_t socket = nullptr;
    lock();
    disconnect_requested_.store(false);
    connected_.store(false);
    closing_.store(true);
    session_started_ = false;
    session_requested_ = false;
    input_requested_ = false;
    input_end_sent_ = false;
    text_length_ = 0;
    text_fragmented_ = false;
    binary_length_ = 0;
    binary_fragmented_ = false;
    machine_.reset_for_reconnect(last_now_ms_);
    audio_.stop_all();
    socket = websocket_;
    websocket_ = nullptr;
    unlock();
    // esp_websocket_client_close() cannot run from its event callback. The
    // runtime calls this function outside the callback, after detaching the
    // handle under the mutex.
    if (socket != nullptr) {
        (void)esp_websocket_client_close(socket, pdMS_TO_TICKS(1000));
        (void)esp_websocket_client_destroy(socket);
    }
    closing_.store(false);
#endif
}

void TransportClient::poll(std::uint64_t now_ms) {
#ifdef ESP_PLATFORM
    if (disconnect_requested_.exchange(false)) {
        disconnect();
        return;
    }
    lock();
    last_now_ms_ = now_ms;
    if (!connected_.load() || websocket_ == nullptr) {
        unlock();
        return;
    }
    const auto timeout = machine_.tick(now_ms);
    if (timeout.stop_capture) audio_.stop_capture();
    if (timeout.flush_playback) audio_.flush_playback();
    if (timeout.send_input_end && !input_end_sent_ &&
        machine_.phase() == protocol::SessionPhase::kCapturing) {
        const std::uint32_t last_sequence = machine_.next_input_sequence() == 0
                                                ? 0
                                                : machine_.next_input_sequence() - 1U;
        const std::string json = protocol::encode_input_end(
            event_id(), machine_.session_id(), machine_.turn_id(), last_sequence);
        if (!send_text(json)) {
            report_error("input_end_failed");
            unlock();
            disconnect();
            return;
        }
        input_end_sent_ = true;
    }
    if (timeout.close_socket) {
        report_error("session_expired");
        unlock();
        disconnect();
        return;
    }
    if (waiting_for_pong_ && now_ms - last_ping_ms_ > 10'000) {
        report_error("heartbeat_timeout");
        unlock();
        disconnect();
        return;
    }
    if (now_ms - last_ping_ms_ >= 15'000) {
        if (!send_ping()) {
            report_error("heartbeat_failed");
            unlock();
            disconnect();
            return;
        }
        last_ping_ms_ = now_ms;
        waiting_for_pong_ = true;
    }
    if (machine_.phase() == protocol::SessionPhase::kCapturing &&
        !controls_.microphone_muted()) {
        audio::CaptureFrame frame;
        if (audio_.read_capture(&frame, 0)) {
            if (!send_audio_frame(frame)) {
                report_error("audio_send_failed");
                unlock();
                disconnect();
                return;
            }
        }
    }
    unlock();
#else
    last_now_ms_ = now_ms;
    (void)now_ms;
#endif
}

bool TransportClient::begin_session(const std::string& mode, const std::string& ticket) {
#ifdef ESP_PLATFORM
    lock();
    if (!connected_.load() || session_requested_ ||
        (mode != "private" && mode != "personal")) {
        unlock();
        return false;
    }
    if (mode == "personal" && ticket.empty()) {
        unlock();
        return false;
    }
    requested_mode_ = mode;
    requested_ticket_ = ticket;
    const std::string json = protocol::encode_session_start(event_id(), ticket, mode);
    if (!send_text(json)) {
        unlock();
        return false;
    }
    stop_requested_.store(false);
    session_requested_ = true;
    machine_.accept_session_start(mode == "personal" ? protocol::SessionMode::kPersonal
                                                       : protocol::SessionMode::kPrivate,
                                  mode == "private" || !ticket.empty(), last_now_ms_);
    unlock();
    return true;
#else
    (void)mode;
    (void)ticket;
    return false;
#endif
}

bool TransportClient::begin_input() {
#ifdef ESP_PLATFORM
    lock();
    if (!connected_.load() || !session_started_ || machine_.phase() != protocol::SessionPhase::kReady ||
        input_requested_) {
        unlock();
        return false;
    }
    client_turn_id_ = uuid();
    const std::string json = protocol::encode_input_start(event_id(), machine_.session_id(),
                                                          client_turn_id_);
    if (!send_text(json)) {
        unlock();
        return false;
    }
    stop_requested_.store(false);
    input_end_sent_ = false;
    input_requested_ = true;
    unlock();
    return true;
#else
    return false;
#endif
}

bool TransportClient::end_input() {
#ifdef ESP_PLATFORM
    lock();
    if (!connected_.load() || machine_.phase() != protocol::SessionPhase::kCapturing ||
        input_end_sent_) {
        unlock();
        return false;
    }
    const std::uint32_t last_sequence = machine_.next_input_sequence() == 0
                                            ? 0
                                            : machine_.next_input_sequence() - 1U;
    const std::string json = protocol::encode_input_end(event_id(), machine_.session_id(),
                                                        machine_.turn_id(), last_sequence);
    if (!send_text(json)) {
        unlock();
        return false;
    }
    input_end_sent_ = true;
    audio_.stop_capture();
    unlock();
    return true;
#else
    return false;
#endif
}

bool TransportClient::end_session() {
#ifdef ESP_PLATFORM
    lock();
    if (!connected_.load() || !session_started_) {
        unlock();
        return false;
    }
    const bool sent = send_text(protocol::encode_session_end(event_id(), machine_.session_id()));
    audio_.stop_all();
    machine_.accept_session_end(last_now_ms_);
    unlock();
    return sent;
#else
    return false;
#endif
}

bool TransportClient::local_stop() {
#ifdef ESP_PLATFORM
    // Mute and flush before waiting for the transport lock. A websocket
    // callback may be holding that lock while a late event is decoded.
    stop_requested_.store(true);
    audio_.stop_all();
    lock();
    // A callback that passed the latch check before local_stop set it may
    // have unmuted while the lock was changing hands. Reapply the stop under
    // the lock before any cancellation frame is sent.
    audio_.stop_all();
    if (!connected_.load()) {
        unlock();
        return false;
    }
    const protocol::SessionPhase phase = machine_.phase();
    bool sent = true;
    if ((phase == protocol::SessionPhase::kProcessing ||
         phase == protocol::SessionPhase::kSpeaking) && !machine_.response_id().empty()) {
        sent = send_text(protocol::encode_response_cancel(event_id(), machine_.session_id(),
                                                          machine_.response_id()));
    } else if (phase == protocol::SessionPhase::kCapturing) {
        sent = end_input();
    }
    machine_.local_stop(last_now_ms_);
    unlock();
    return sent;
#else
    return false;
#endif
}

std::string TransportClient::event_id() const { return uuid(); }

std::string TransportClient::uuid() const {
#ifdef ESP_PLATFORM
    std::uint8_t bytes[16] = {};
    esp_fill_random(bytes, sizeof(bytes));
    bytes[6] = static_cast<std::uint8_t>((bytes[6] & 0x0fU) | 0x40U);
    bytes[8] = static_cast<std::uint8_t>((bytes[8] & 0x3fU) | 0x80U);
    char value[37] = {};
    std::snprintf(value, sizeof(value),
                  "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
                  bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                  bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14],
                  bytes[15]);
    return value;
#else
    return {};
#endif
}

void TransportClient::report_error(const char* code) {
#ifdef ESP_PLATFORM
    ESP_LOGW(kTag, "transport error: %s", code == nullptr ? "unknown" : code);
#endif
    if (callbacks_.on_error) callbacks_.on_error(code == nullptr ? "unknown" : code);
}

#ifdef ESP_PLATFORM
void TransportClient::websocket_event(void* handler_arg, esp_event_base_t /*base*/,
                                      int32_t event_id, void* event_data) {
    auto* client = static_cast<TransportClient*>(handler_arg);
    client->on_websocket_event(event_id,
                               static_cast<esp_websocket_event_data_t*>(event_data));
}

void TransportClient::on_websocket_event(int32_t event_id, esp_websocket_event_data_t* event) {
    if (event == nullptr) return;
    lock();
    if (closing_.load() && event_id != WEBSOCKET_EVENT_DISCONNECTED) {
        unlock();
        return;
    }
    switch (event_id) {
        case WEBSOCKET_EVENT_CONNECTED:
            connected_.store(true);
            last_pong_ms_ = monotonic_ms();
            last_ping_ms_ = last_pong_ms_;
            last_now_ms_ = last_pong_ms_;
            waiting_for_pong_ = false;
            if (callbacks_.on_connected) callbacks_.on_connected();
            break;
        case WEBSOCKET_EVENT_DATA: {
            if (event->op_code == WS_TRANSPORT_OPCODES_PONG) {
                last_pong_ms_ = monotonic_ms();
                waiting_for_pong_ = false;
                break;
            }
            if (event->data_ptr == nullptr || event->data_len > kMaxJsonFrame + 9608U) break;
            const std::size_t payload_len = event->payload_len > 0
                                                ? static_cast<std::size_t>(event->payload_len)
                                                : static_cast<std::size_t>(event->data_len);
            if (event->op_code == WS_TRANSPORT_OPCODES_TEXT) {
                if (payload_len > kMaxJsonFrame ||
                    event->payload_offset + event->data_len > kMaxJsonFrame) {
                    report_error("oversized_control");
                    text_length_ = 0;
                    text_fragmented_ = false;
                    break;
                }
                if (event->payload_offset == 0) {
                    text_length_ = 0;
                    text_fragmented_ = payload_len > static_cast<std::size_t>(event->data_len);
                }
                if (event->payload_offset != text_length_ ||
                    text_length_ + event->data_len > text_buffer_.size()) {
                    report_error("invalid_control");
                    text_length_ = 0;
                    text_fragmented_ = false;
                    break;
                }
                std::memcpy(text_buffer_.data() + text_length_, event->data_ptr,
                            event->data_len);
                text_length_ += event->data_len;
                if (!text_fragmented_ || event->fin || text_length_ == payload_len) {
                    (void)parse_server_event(text_buffer_.data(), text_length_);
                    text_length_ = 0;
                    text_fragmented_ = false;
                }
            } else if (event->op_code == WS_TRANSPORT_OPCODES_BINARY) {
                if (payload_len > binary_buffer_.size() ||
                    event->payload_offset + event->data_len > binary_buffer_.size()) {
                    report_error("oversized_audio");
                    binary_length_ = 0;
                    binary_fragmented_ = false;
                    break;
                }
                if (event->payload_offset == 0) {
                    binary_length_ = 0;
                    binary_fragmented_ = payload_len > static_cast<std::size_t>(event->data_len);
                }
                if (event->payload_offset != binary_length_ ||
                    binary_length_ + event->data_len > binary_buffer_.size()) {
                    report_error("invalid_audio");
                    binary_length_ = 0;
                    binary_fragmented_ = false;
                    break;
                }
                std::memcpy(binary_buffer_.data() + binary_length_, event->data_ptr,
                            event->data_len);
                binary_length_ += event->data_len;
                if (!binary_fragmented_ || event->fin || binary_length_ == payload_len) {
                    handle_binary(binary_buffer_.data(), binary_length_);
                    binary_length_ = 0;
                    binary_fragmented_ = false;
                }
            }
            break;
        }
        case WEBSOCKET_EVENT_DISCONNECTED:
            connected_.store(false);
            if (!closing_.load()) disconnect_requested_.store(true);
            session_started_ = false;
            session_requested_ = false;
            input_requested_ = false;
            input_end_sent_ = false;
            audio_.stop_all();
            machine_.reset_for_reconnect(monotonic_ms());
            if (callbacks_.on_closed) callbacks_.on_closed();
            break;
        case WEBSOCKET_EVENT_ERROR:
            report_error("websocket_error");
            break;
        default:
            break;
    }
    unlock();
}

void TransportClient::handle_text(const char* data, std::size_t length) {
    // The protocol allows fragmented transport frames but still caps one
    // logical control message at 16 KiB.
    if (length > kMaxJsonFrame) {
        report_error("oversized_control");
        return;
    }
    (void)parse_server_event(data, length);
}

void TransportClient::handle_binary(const std::uint8_t* data, std::size_t length) {
    if (stop_requested_.load() || machine_.phase() != protocol::SessionPhase::kSpeaking) return;
    const protocol::SessionAction action = machine_.accept_output(data, length, last_now_ms_);
    if (!action.accepted) {
        report_error("invalid_audio");
        audio_.flush_playback();
        return;
    }
    constexpr std::size_t kHeader = protocol::kOutputFrameHeaderBytes;
    std::array<std::int16_t, protocol::kOutputPcmBytesMax / 2> pcm{};
    const std::size_t bytes = length - kHeader;
    if (bytes == 0) return;
    std::memcpy(pcm.data(), data + kHeader, bytes);
    if (!audio_.enqueue_playback(pcm.data(), bytes / sizeof(std::int16_t))) {
        report_error("buffer_overflow");
        (void)local_stop();
    }
}

bool TransportClient::parse_server_event(const char* data, std::size_t length) {
    if (data == nullptr || length == 0 || length > kMaxJsonFrame) return false;
    cJSON* root = cJSON_ParseWithLength(data, length);
    if (root == nullptr || !cJSON_IsObject(root)) {
        cJSON_Delete(root);
        report_error("invalid_control");
        return false;
    }
    const char* type = string_field(root, "type");
    const char* event_id_value = string_field(root, "event_id");
    if (type == nullptr || event_id_value == nullptr || !machine_.remember_event_id(event_id_value)) {
        cJSON_Delete(root);
        return false;
    }
    bool ok = true;
    if (std::strcmp(type, "session.ready") == 0) {
        const char* id = string_field(root, "session_id");
        ok = id != nullptr && machine_.accept_session_ready(id, last_now_ms_).accepted;
        if (ok) {
            session_requested_ = false;
            session_started_ = true;
            if (callbacks_.on_ready) callbacks_.on_ready();
        }
    } else if (std::strcmp(type, "input.ready") == 0) {
        const char* session_id = string_field(root, "session_id");
        const char* turn_id = string_field(root, "turn_id");
        const char* response_id = string_field(root, "response_id");
        ok = !stop_requested_.load() && session_id != nullptr && turn_id != nullptr && response_id != nullptr &&
             input_requested_ &&
             machine_.accept_input_ready(session_id, turn_id, response_id, last_now_ms_).accepted;
        if (ok) {
            input_requested_ = false;
            audio_.flush_playback();
            if (!controls_.microphone_muted()) {
                audio_.set_output_muted(false);
                audio_.start_capture();
                controls_.set_indicator(controls::Indicator::kCapturing);
            } else {
                // Keep the physical mute authoritative. A later unmute needs
                // the runtime capture gate; it never changes this input's
                // physical mute state here.
                audio_.stop_capture();
                controls_.set_indicator(controls::Indicator::kOff);
            }
        }
    } else if (std::strcmp(type, "transcript.final") == 0) {
        const char* session_id = string_field(root, "session_id");
        const char* turn_id = string_field(root, "turn_id");
        ok = session_id != nullptr && turn_id != nullptr &&
             machine_.accept_transcript_final(session_id, turn_id, last_now_ms_).accepted;
        if (ok) {
            audio_.stop_capture();
            controls_.set_indicator(controls::Indicator::kOff);
        }
    } else if (std::strcmp(type, "response.start") == 0) {
        const char* session_id = string_field(root, "session_id");
        const char* turn_id = string_field(root, "turn_id");
        const char* response_id = string_field(root, "response_id");
        const cJSON* sequence = cJSON_GetObjectItemCaseSensitive(root, "response_sequence");
        ok = !stop_requested_.load() && session_id != nullptr && turn_id != nullptr && response_id != nullptr &&
             cJSON_IsNumber(sequence) &&
             machine_.accept_response_start(session_id, turn_id, response_id,
                                            static_cast<std::uint32_t>(sequence->valuedouble),
                                            last_now_ms_)
                 .accepted;
        if (ok) {
            audio_.stop_capture();
            audio_.flush_playback();
            audio_.set_output_muted(false);
            controls_.set_indicator(controls::Indicator::kOff);
        }
    } else if (std::strcmp(type, "response.end") == 0) {
        const char* response_id = string_field(root, "response_id");
        ok = !stop_requested_.load() && response_id != nullptr &&
             machine_.accept_response_end(response_id, last_now_ms_).accepted;
        if (ok) {
            audio_.set_output_muted(false);
            controls_.set_indicator(controls::Indicator::kOff);
        }
    } else if (std::strcmp(type, "session.summary_ready") == 0) {
        audio_.stop_all();
        session_started_ = false;
        input_requested_ = false;
    } else if (std::strcmp(type, "error") == 0) {
        report_error("server_error");
        ok = false;
    }
    cJSON_Delete(root);
    if (!ok) report_error("invalid_state");
    return ok;
}

bool TransportClient::send_text(const std::string& text) {
    if (websocket_ == nullptr || text.empty() || text.size() > kMaxJsonFrame) return false;
    return esp_websocket_client_send_text(websocket_, text.data(), static_cast<int>(text.size()),
                                          pdMS_TO_TICKS(1000)) == static_cast<int>(text.size());
}

bool TransportClient::send_audio_frame(const audio::CaptureFrame& frame) {
    std::array<std::uint8_t, protocol::kInputFrameBytes> packet{};
    protocol::write_be32(packet.data(), machine_.next_input_sequence());
    std::memcpy(packet.data() + 4, frame.pcm.data(), protocol::kInputPcmBytes);
    const int sent = esp_websocket_client_send_bin(
        websocket_, reinterpret_cast<const char*>(packet.data()), static_cast<int>(packet.size()),
        pdMS_TO_TICKS(1000));
    if (sent != static_cast<int>(packet.size())) return false;
    // The state machine sees the same bytes after the socket write. It is
    // deliberate that a failed send does not advance the sequence or replay.
    return machine_.accept_audio(packet.data(), packet.size(), last_now_ms_).accepted;
}

bool TransportClient::send_ping() {
    return esp_websocket_client_send_with_opcode(websocket_, WS_TRANSPORT_OPCODES_PING, nullptr, 0,
                                                 pdMS_TO_TICKS(1000)) == 0;
}
#endif

}  // namespace soba::transport
