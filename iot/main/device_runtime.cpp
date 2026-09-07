#include "device_runtime.h"

#include "board_config.h"

#ifdef ESP_PLATFORM
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sntp.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lwip/ip4_addr.h"
#endif

#include <algorithm>
#include <ctime>
#include <utility>

namespace soba {

namespace {
constexpr char kTag[] = "soba.runtime";
}

DeviceRuntime::DeviceRuntime()
    : provisioning_(storage_, device_state_), telemetry_(storage_),
      transport_(audio_, controls_, storage_,
                 transport::TransportCallbacks{
                     [this]() { on_transport_connected(); },
                     [this]() { on_transport_ready(); },
                     [this]() { on_transport_closed(); },
                     [this](const char* code) { on_transport_error(code); },
                 }) {}

bool DeviceRuntime::init() {
#ifdef ESP_PLATFORM
    if (!storage_.init()) {
        ESP_LOGE(kTag, "encrypted NVS is not ready; refusing to start");
        return false;
    }
    if (!controls_.init()) return false;
    if (!ota_.init()) return false;
    if (!init_network()) return false;
    if (!provisioning_.init()) {
        ESP_LOGE(kTag, "secure BLE provisioning setup failed");
        return false;
    }
    if (!audio_.init()) {
        // The firmware can still provision and report status while a board pin
        // map is being reviewed. It never claims audio is ready in this state.
        ESP_LOGW(kTag, "audio pipeline is unavailable until board pins are configured");
    }
    const bool provisioning_only = provisioning_.active() && storage_.operational_token().empty();
    if (!audio_.healthy() && !provisioning_only) {
        ESP_LOGE(kTag, "paired firmware requires a healthy audio pipeline");
        (void)ota_.mark_boot_healthy(false);
        return false;
    }
    (void)telemetry_.init();
    transport_initialized_ = transport_.init();
    initialized_ = ota_.mark_boot_healthy(true);
    if (!initialized_) return false;
    controls_.set_indicator(controls::Indicator::kConnecting);
    return true;
#else
    return false;
#endif
}

#ifdef ESP_PLATFORM
bool DeviceRuntime::init_network() {
    const esp_err_t netif_error = esp_netif_init();
    if (netif_error != ESP_OK && netif_error != ESP_ERR_INVALID_STATE) return false;
    const esp_err_t event_error = esp_event_loop_create_default();
    if (event_error != ESP_OK && event_error != ESP_ERR_INVALID_STATE) return false;
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t config = WIFI_INIT_CONFIG_DEFAULT();
    if (esp_wifi_init(&config) != ESP_OK) return false;
    if (esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event, this) != ESP_OK ||
        esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event, this) != ESP_OK) {
        return false;
    }
    if (esp_wifi_set_mode(WIFI_MODE_STA) != ESP_OK || esp_wifi_start() != ESP_OK) return false;
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
    time_sync_started_ = true;
    return true;
}

bool DeviceRuntime::network_time_ready() const {
    if (!time_sync_started_) return false;
    std::time_t current = 0;
    std::time(&current);
    // Certificate validation is unsafe with the ESP32 default epoch. This is
    // only a lower bound; SNTP remains the source of wall-clock time.
    return current >= static_cast<std::time_t>(1'577'836'800);
}

void DeviceRuntime::wifi_event(void* arg, esp_event_base_t event_base, std::int32_t event_id,
                               void* event_data) {
    static_cast<DeviceRuntime*>(arg)->on_wifi_event(event_base, event_id, event_data);
}

void DeviceRuntime::on_wifi_event(esp_event_base_t event_base, std::int32_t event_id,
                                  void* /*event_data*/) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        (void)esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        network_ready_ = true;
        next_connect_ms_ = 0;
        connect_backoff_ms_ = 1'000;
        (void)device_state_.wifi_connected();
        controls_.set_indicator(controls::Indicator::kOff);
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        network_ready_ = false;
        transport_.request_disconnect();
        (void)device_state_.wifi_lost();
        controls_.set_indicator(controls::Indicator::kConnecting);
        (void)esp_wifi_connect();
    }
}
#endif

void DeviceRuntime::on_transport_connected() {
    if (!start_pending_ || !transport_.begin_session("private")) {
        start_pending_ = false;
        transport_.request_disconnect();
    }
}

void DeviceRuntime::on_transport_ready() {
    controls_.set_indicator(controls::Indicator::kOff);
    if (start_pending_) {
        if (transport_.begin_input()) {
            start_pending_ = false;
        } else {
            start_pending_ = false;
            transport_.request_disconnect();
        }
    }
}

void DeviceRuntime::on_transport_closed() {
    // A socket close discards the pending action. A later physical press is
    // required before a new session can capture; reconnect never replays it.
    start_pending_ = false;
    controls_.set_indicator(network_ready_ ? controls::Indicator::kConnecting
                                            : controls::Indicator::kError);
}

void DeviceRuntime::on_transport_error(const char* /*code*/) {
    controls_.set_indicator(controls::Indicator::kError);
}

void DeviceRuntime::poll(std::uint64_t now_ms) {
#ifdef ESP_PLATFORM
    controls_.poll(now_ms);
    // Consume stop before any transport phase lookup. A WSS send can hold
    // the transport lock, while the physical stop must mute audio first.
    const bool stop_requested = controls_.consume_stop_request();
    if (stop_requested) {
        start_pending_ = false;
        audio_.stop_all();
        if (!transport_.local_stop() && transport_.connected()) transport_.disconnect();
    }
    const bool start_requested = controls_.consume_start_request();
    if (!stop_requested && controls_.microphone_muted()) {
        audio_.stop_capture();
        controls_.set_indicator(controls::Indicator::kOff);
    } else if (!stop_requested && transport_.phase() == protocol::SessionPhase::kCapturing) {
        // A physical mute gates capture only. Releasing it resumes the
        // current input turn without changing the mute state in software.
        audio_.set_output_muted(false);
        audio_.start_capture();
        controls_.set_indicator(controls::Indicator::kCapturing);
    }
    if (!stop_requested && start_requested) {
        if (transport_.connected() && transport_.phase() == protocol::SessionPhase::kReady) {
            start_pending_ = true;
            if (transport_.begin_input()) start_pending_ = false;
        } else if (!transport_.connected()) {
            start_pending_ = true;
            controls_.set_indicator(controls::Indicator::kConnecting);
        }
    }
    const bool end_turn_requested = controls_.consume_end_turn_request();
    if (!stop_requested && end_turn_requested && transport_.connected() &&
        transport_.phase() == protocol::SessionPhase::kCapturing) {
        (void)transport_.end_input();
    }
    if (provisioning_.active()) provisioning_.tick(now_ms);
    // The heartbeat uses a synchronous HTTPS request. Keep it out of an
    // active WSS session so a slow network cannot delay the 10 ms GPIO poll and
    // the physical mute/stop path. A heartbeat can be stale while the WSS
    // session is active; the next idle window sends it.
    const bool audio_idle = !audio_.is_capture_running() && audio_.is_output_muted();
    time_synced_ = network_time_ready();
    if (network_ready_.load() && time_synced_.load() && !transport_.connected() &&
        !start_pending_.load() && audio_idle) {
        telemetry_.tick(now_ms);
    }
    if (network_ready_ && time_synced_ && start_pending_ && !provisioning_.active() &&
        !transport_.connected() &&
        now_ms >= next_connect_ms_) {
        if (!transport_initialized_) transport_initialized_ = transport_.init();
        if (transport_initialized_) {
            if (transport_.connect()) {
                next_connect_ms_ = now_ms + 1'000;
                connect_backoff_ms_ = 1'000;
            } else {
                next_connect_ms_ = now_ms + connect_backoff_ms_;
                connect_backoff_ms_ = std::min<std::uint32_t>(connect_backoff_ms_ * 2U, 30'000U);
            }
        }
    }
    transport_.poll(now_ms);
    if (network_ready_.load() && time_synced_.load() && !provisioning_.active() &&
        !start_pending_.load() && !transport_.connected() && audio_idle) {
        // OTA downloads are synchronous and can take seconds. They run only
        // while the socket is fully disconnected and both audio paths are
        // stopped, never during a ready, processing, or speaking session.
        ota_.poll(now_ms);
    }
    if (controls_.provision_button_active() && !provisioning_.active() &&
        storage_.operational_token().empty()) {
        (void)provisioning_.physical_restart();
    }
#else
    (void)now_ms;
#endif
}

void DeviceRuntime::run() {
#ifdef ESP_PLATFORM
    while (true) {
        poll(static_cast<std::uint64_t>(esp_timer_get_time() / 1000));
        vTaskDelay(pdMS_TO_TICKS(10));
    }
#endif
}

}  // namespace soba
