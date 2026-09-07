#include "telemetry.h"

#ifdef ESP_PLATFORM
#include "cJSON.h"
#include "esp_app_desc.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "sdkconfig.h"
#endif

#include <array>
#include <cmath>
#include <cstring>
#include <limits>
#include <string>

namespace soba::telemetry {

namespace {
constexpr char kTag[] = "soba.telemetry";
constexpr std::uint64_t kHeartbeatPeriodMs = 30'000;

struct ResponseBuffer {
    char* data = nullptr;
    std::size_t capacity = 0;
    std::size_t length = 0;
    bool overflow = false;
};

esp_err_t capture_response_body(esp_http_client_event_t* event) {
    if (event == nullptr || event->user_data == nullptr) return ESP_OK;
    auto* response = static_cast<ResponseBuffer*>(event->user_data);
    if (event->event_id != HTTP_EVENT_ON_DATA || event->data == nullptr || event->data_len <= 0) {
        return ESP_OK;
    }
    const std::size_t bytes = static_cast<std::size_t>(event->data_len);
    if (response->length + bytes >= response->capacity) {
        response->overflow = true;
        return ESP_OK;
    }
    std::memcpy(response->data + response->length, event->data, bytes);
    response->length += bytes;
    response->data[response->length] = '\0';
    return ESP_OK;
}
}

DeviceTelemetry::DeviceTelemetry(storage::PreferencesStore& storage) : storage_(storage) {}

bool DeviceTelemetry::init() {
#ifdef ESP_PLATFORM
    initialized_ = storage_.secure_storage_ready() && !storage_.device_id().empty();
    if (!initialized_) ESP_LOGW(kTag, "heartbeat disabled until secure device identity is ready");
    return initialized_;
#else
    return false;
#endif
}

void DeviceTelemetry::set_battery_reader(std::function<bool(std::uint8_t*)> reader) {
    battery_reader_ = std::move(reader);
}

void DeviceTelemetry::tick(std::uint64_t now_ms) {
#ifdef ESP_PLATFORM
    if (!initialized_ || !battery_reader_ || now_ms < next_heartbeat_ms_) return;
    std::uint8_t battery = 0;
    if (!battery_reader_(&battery) || battery > 100) {
        ESP_LOGW(kTag, "heartbeat deferred; no calibrated battery reading");
        next_heartbeat_ms_ = now_ms + 5'000;
        return;
    }
    next_heartbeat_ms_ = now_ms + kHeartbeatPeriodMs;
    if (!send_heartbeat(battery)) ESP_LOGW(kTag, "heartbeat failed");
#else
    (void)now_ms;
#endif
}

bool DeviceTelemetry::send_heartbeat(std::uint8_t battery_percent) {
#ifdef ESP_PLATFORM
    const std::string endpoint = CONFIG_SOBA_API_HEARTBEAT_URI;
    if (endpoint.rfind("https://", 0) != 0 || endpoint.size() > 512) return false;
    const std::string token = storage_.operational_token();
    if (token.empty()) return false;
    const esp_app_desc_t* app = esp_app_get_description();
    const std::string firmware = app == nullptr ? "unknown" : app->version;
    storage::DevicePreferences preferences;
    if (!storage_.load_preferences(&preferences)) return false;
    cJSON* body = cJSON_CreateObject();
    if (body == nullptr) return false;
    cJSON_AddNumberToObject(body, "battery_percent", battery_percent);
    cJSON_AddStringToObject(body, "firmware_version", firmware.c_str());
    cJSON_AddNumberToObject(body, "applied_preferences_version", preferences.version);
    char* body_text = cJSON_PrintUnformatted(body);
    cJSON_Delete(body);
    if (body_text == nullptr) return false;

    esp_http_client_config_t config = {};
    config.url = endpoint.c_str();
    config.method = HTTP_METHOD_POST;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.disable_auto_redirect = true;
    config.timeout_ms = 5'000;
    config.buffer_size = 2048;
    std::array<char, 4096> response{};
    ResponseBuffer response_body{response.data(), response.size(), 0, false};
    config.event_handler = capture_response_body;
    config.user_data = &response_body;
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == nullptr) {
        cJSON_free(body_text);
        return false;
    }
    const std::string auth = "Bearer " + token;
    (void)esp_http_client_set_header(client, "Authorization", auth.c_str());
    (void)esp_http_client_set_header(client, "Content-Type", "application/json");
    bool ok = esp_http_client_set_post_field(client, body_text, std::strlen(body_text)) == ESP_OK &&
              esp_http_client_perform(client) == ESP_OK &&
              esp_http_client_get_status_code(client) == 200;
    cJSON_free(body_text);
    if (ok) {
        if (!response_body.overflow && response_body.length > 0) {
            cJSON* root = cJSON_ParseWithLength(response.data(), response_body.length);
            if (root != nullptr) {
                const cJSON* remote_preferences =
                    cJSON_GetObjectItemCaseSensitive(root, "preferences");
                const cJSON* voice_enabled =
                    cJSON_GetObjectItemCaseSensitive(root, "voice_enabled");
                if (cJSON_IsObject(remote_preferences) && cJSON_IsBool(voice_enabled)) {
                    // The full Preferences schema is intentionally decoded only
                    // after strict bounds checks. Invalid remote preferences are
                    // ignored and cannot overwrite local state.
                    const cJSON* personality =
                        cJSON_GetObjectItemCaseSensitive(remote_preferences, "personality");
                    const cJSON* voice = cJSON_GetObjectItemCaseSensitive(remote_preferences, "voice");
                    const cJSON* version = cJSON_GetObjectItemCaseSensitive(remote_preferences, "version");
                    const cJSON* listen = cJSON_GetObjectItemCaseSensitive(remote_preferences, "listen_first");
                    const cJSON* memory = cJSON_GetObjectItemCaseSensitive(remote_preferences, "memory_enabled");
                    if (cJSON_IsString(personality) && cJSON_IsString(voice) && cJSON_IsNumber(version) &&
                        cJSON_IsBool(listen) && cJSON_IsBool(memory) &&
                        std::strlen(personality->valuestring) <= 32 &&
                        std::strlen(voice->valuestring) <= 32 && std::isfinite(version->valuedouble) &&
                        version->valuedouble >= 0 &&
                        version->valuedouble <=
                            static_cast<double>(std::numeric_limits<std::uint32_t>::max()) &&
                        std::floor(version->valuedouble) == version->valuedouble) {
                        storage::DevicePreferences updated;
                        updated.locale = preferences.locale;
                        updated.personality = personality->valuestring;
                        updated.voice = voice->valuestring;
                        // The firmware preferences model stores the personality
                        // as the locale-independent voice profile only until the
                        // backend exposes a separate device field.
                        updated.version = static_cast<std::uint32_t>(version->valuedouble);
                        updated.listen_first = cJSON_IsTrue(listen);
                        updated.memory_enabled = cJSON_IsTrue(memory);
                        ok = storage_.save_preferences(updated);
                    }
                }
                cJSON_Delete(root);
            }
        }
    }
    (void)esp_http_client_cleanup(client);
    return ok;
#else
    (void)battery_percent;
    return false;
#endif
}

}  // namespace soba::telemetry
