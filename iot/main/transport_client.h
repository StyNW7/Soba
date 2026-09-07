#pragma once

#include "audio_pipeline.h"
#include "controls.h"
#include "preferences_store.h"
#include "protocol/session_machine.h"

#include <array>
#include <atomic>
#include <cstdint>
#include <functional>
#include <string>

#ifdef ESP_PLATFORM
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "esp_websocket_client.h"
#endif

namespace soba::transport {

struct TransportCallbacks {
    std::function<void()> on_connected;
    std::function<void()> on_ready;
    std::function<void()> on_closed;
    std::function<void(const char*)> on_error;
};

class TransportClient final {
   public:
    TransportClient(audio::AudioPipeline& audio, controls::HardwareControls& controls,
                    storage::PreferencesStore& storage, TransportCallbacks callbacks);
    ~TransportClient();

    bool init();
    bool connect();
    // Schedule a close from the runtime task. The websocket event callback
    // must not call esp_websocket_client_close() directly.
    void request_disconnect() { disconnect_requested_.store(true); }
    void disconnect();
    void poll(std::uint64_t now_ms);

    bool begin_session(const std::string& mode, const std::string& ticket = {});
    bool begin_input();
    bool end_input();
    bool end_session();
    bool local_stop();
    bool connected() const { return connected_.load(); }
    protocol::SessionPhase phase() const;

   private:
#ifdef ESP_PLATFORM
    static void websocket_event(void* handler_arg, esp_event_base_t base,
                                int32_t event_id, void* event_data);
    void on_websocket_event(int32_t event_id, esp_websocket_event_data_t* event);
    void handle_text(const char* data, std::size_t length);
    void handle_binary(const std::uint8_t* data, std::size_t length);
    bool send_text(const std::string& text);
    bool send_audio_frame(const audio::CaptureFrame& frame);
    bool send_ping();
    bool parse_server_event(const char* data, std::size_t length);
    void lock() const;
    void unlock() const;
#endif
    std::string event_id() const;
    std::string uuid() const;
    void report_error(const char* code);

    audio::AudioPipeline& audio_;
    controls::HardwareControls& controls_;
    storage::PreferencesStore& storage_;
    TransportCallbacks callbacks_;
    protocol::SessionMachine machine_;
    std::string uri_;
    std::string auth_header_;
    std::string token_;
    std::string requested_mode_;
    std::string requested_ticket_;
    std::string client_turn_id_;
    std::uint64_t last_now_ms_ = 0;
    std::uint64_t last_ping_ms_ = 0;
    std::uint64_t last_pong_ms_ = 0;
    bool waiting_for_pong_ = false;
    bool initialized_ = false;
    std::atomic<bool> connected_{false};
    std::atomic<bool> disconnect_requested_{false};
    std::atomic<bool> closing_{false};
    // Set before local stop waits for the transport lock. Late server events
    // must not restart capture or unmute playback while that lock is busy.
    std::atomic<bool> stop_requested_{false};
    bool session_requested_ = false;
    bool session_started_ = false;
    bool input_requested_ = false;
    bool input_end_sent_ = false;
#ifdef ESP_PLATFORM
    mutable SemaphoreHandle_t mutex_ = nullptr;
    esp_websocket_client_handle_t websocket_ = nullptr;
    std::array<char, 16 * 1024> text_buffer_{};
    std::size_t text_length_ = 0;
    bool text_fragmented_ = false;
    std::array<std::uint8_t, 9'608> binary_buffer_{};
    std::size_t binary_length_ = 0;
    bool binary_fragmented_ = false;
#endif
};

}  // namespace soba::transport
