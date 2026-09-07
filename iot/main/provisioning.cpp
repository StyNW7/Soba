#include "provisioning.h"

#ifdef ESP_PLATFORM
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "wifi_provisioning/manager.h"
#include "wifi_provisioning/scheme_ble.h"
#include "protocomm.h"
#endif

#include <array>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace soba::provisioning {

namespace {
constexpr char kTag[] = "soba.provision";
constexpr char kEndpoint[] = "soba-claim";
constexpr std::uint64_t kProvisioningWindowMs = 5 * 60 * 1000;

bool safe_token(const char* value) {
    if (value == nullptr || *value == '\0') return false;
    for (const unsigned char c : std::string(value)) {
        if (!(std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~')) return false;
    }
    return true;
}

#ifdef ESP_PLATFORM
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
#endif

std::string hex_random(std::size_t bytes) {
#ifdef ESP_PLATFORM
    std::array<std::uint8_t, 32> random{};
    if (bytes > random.size()) bytes = random.size();
    esp_fill_random(random.data(), bytes);
    std::string result;
    result.reserve(bytes * 2);
    constexpr char hex[] = "0123456789abcdef";
    for (std::size_t i = 0; i < bytes; ++i) {
        result.push_back(hex[random[i] >> 4]);
        result.push_back(hex[random[i] & 0x0fU]);
    }
    return result;
#else
    (void)bytes;
    return {};
#endif
}
}

ProvisioningManager::ProvisioningManager(storage::PreferencesStore& storage,
                                         protocol::DeviceStateMachine& device_state)
    : storage_(storage), device_state_(device_state) {
#ifdef ESP_PLATFORM
    mutex_ = xSemaphoreCreateMutex();
#endif
}

ProvisioningManager::~ProvisioningManager() {
#ifdef ESP_PLATFORM
    if (mutex_ != nullptr) vSemaphoreDelete(mutex_);
#endif
}

#ifdef ESP_PLATFORM
void ProvisioningManager::lock() const {
    if (mutex_ != nullptr) (void)xSemaphoreTake(mutex_, portMAX_DELAY);
}

void ProvisioningManager::unlock() const {
    if (mutex_ != nullptr) (void)xSemaphoreGive(mutex_);
}
#endif

bool ProvisioningManager::ensure_local_pop() {
    if (!storage_.local_pop().empty()) return true;
    const std::string pop = hex_random(16);
    return !pop.empty() && storage_.set_local_pop(pop);
}

bool ProvisioningManager::init() {
#ifdef ESP_PLATFORM
    if (!storage_.secure_storage_ready() || !ensure_local_pop()) return false;
    if (!storage_.operational_token().empty()) {
        (void)device_state_.cloud_claimed();
        return true;
    }
    wifi_prov_mgr_config_t config = {};
    config.scheme = wifi_prov_scheme_ble;
    // Keep the BLE controller memory. The physical restart path may open a
    // new provisioning window after timeout; FREE_BTDM releases memory that
    // the IDF cannot allocate again without a reboot.
    config.scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    config.app_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    if (wifi_prov_mgr_init(config) != ESP_OK) return false;
    manager_initialized_ = true;
    if (wifi_prov_mgr_endpoint_create(kEndpoint) != ESP_OK) {
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        return false;
    }
    if (!start_service()) {
        wifi_prov_mgr_stop_provisioning();
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        return false;
    }
    return true;
#else
    return false;
#endif
}

#ifdef ESP_PLATFORM
bool ProvisioningManager::start_service() {
    const std::string id = storage_.device_id();
    const std::string service_name = "SOBA-" + (id.empty() ? "device" : id.substr(0, 8));
    const std::string pop = storage_.local_pop();
    if (wifi_prov_mgr_start_provisioning(WIFI_PROV_SECURITY_1, pop.c_str(),
                                         service_name.c_str(), nullptr) != ESP_OK) {
        return false;
    }
    if (wifi_prov_mgr_endpoint_register(kEndpoint, claim_endpoint, this) != ESP_OK) {
        wifi_prov_mgr_stop_provisioning();
        return false;
    }
    active_.store(true);
    started_at_ms_ = 0;
    (void)device_state_.provision_started();
    return true;
}

bool ProvisioningManager::strict_claim_payload(const std::uint8_t* inbuf, ssize_t inlen,
                                               std::string* claim_id,
                                               std::string* challenge) {
    if (inbuf == nullptr || inlen <= 0 || inlen > 1024 || claim_id == nullptr ||
        challenge == nullptr) {
        return false;
    }
    cJSON* root = cJSON_ParseWithLength(reinterpret_cast<const char*>(inbuf), inlen);
    if (root == nullptr || !cJSON_IsObject(root) || cJSON_GetArraySize(root) != 2) {
        cJSON_Delete(root);
        return false;
    }
    const cJSON* claim = cJSON_GetObjectItemCaseSensitive(root, "claim_id");
    const cJSON* value = cJSON_GetObjectItemCaseSensitive(root, "challenge");
    const bool valid = cJSON_IsString(claim) && cJSON_IsString(value) &&
                       std::strlen(claim->valuestring) >= 16 &&
                       std::strlen(claim->valuestring) <= 128 &&
                       std::strlen(value->valuestring) >= 32 &&
                       std::strlen(value->valuestring) <= 512 &&
                       safe_token(claim->valuestring) && safe_token(value->valuestring);
    if (valid) {
        *claim_id = claim->valuestring;
        *challenge = value->valuestring;
    }
    cJSON_Delete(root);
    return valid;
}

esp_err_t ProvisioningManager::claim_endpoint(std::uint32_t /*session_id*/,
                                               const std::uint8_t* inbuf, ssize_t inlen,
                                               std::uint8_t** outbuf, ssize_t* outlen,
                                               void* priv_data) {
    if (outbuf == nullptr || outlen == nullptr || priv_data == nullptr) return ESP_ERR_INVALID_ARG;
    auto* manager = static_cast<ProvisioningManager*>(priv_data);
    std::string claim_id;
    std::string challenge;
    if (!strict_claim_payload(inbuf, inlen, &claim_id, &challenge)) return ESP_ERR_INVALID_ARG;
    manager->lock();
    if (!manager->active_.load() || manager->claim_pending_.load()) {
        manager->unlock();
        return ESP_ERR_INVALID_STATE;
    }
    manager->claim_id_ = std::move(claim_id);
    manager->challenge_ = std::move(challenge);
    manager->claim_pending_.store(true);
    manager->unlock();
    const char response[] = "{\"accepted\":true}";
    *outbuf = static_cast<std::uint8_t*>(std::malloc(sizeof(response) - 1));
    if (*outbuf == nullptr) return ESP_ERR_NO_MEM;
    std::memcpy(*outbuf, response, sizeof(response) - 1);
    *outlen = sizeof(response) - 1;
    return ESP_OK;
}

bool ProvisioningManager::confirm_cloud_claim() {
    const std::string factory = storage_.factory_credential();
    std::string claim_id;
    std::string challenge;
    lock();
    if (claim_pending_.load()) {
        claim_id = claim_id_;
        challenge = challenge_;
    }
    unlock();
    if (factory.empty() || claim_id.empty() || challenge.empty()) return false;
    const std::string url = std::string(CONFIG_SOBA_CLAIM_URI) + claim_id + "/confirm";
    if (url.rfind("https://", 0) != 0 || url.size() > 512) return false;
    esp_http_client_config_t config = {};
    config.url = url.c_str();
    config.method = HTTP_METHOD_POST;
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.disable_auto_redirect = true;
    config.timeout_ms = 5'000;
    config.buffer_size = 1024;
    std::array<char, 2048> response{};
    ResponseBuffer response_body{response.data(), response.size(), 0, false};
    config.event_handler = capture_response_body;
    config.user_data = &response_body;
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == nullptr) return false;
    (void)esp_http_client_set_header(client, "Authorization", ("Bearer " + factory).c_str());
    (void)esp_http_client_set_header(client, "Content-Type", "application/json");
    (void)esp_http_client_set_header(client, "Idempotency-Key", claim_id.c_str());
    const std::string body = "{\"challenge\":\"" + challenge + "\"}";
    bool ok = esp_http_client_set_post_field(client, body.data(), body.size()) == ESP_OK &&
              esp_http_client_perform(client) == ESP_OK &&
              esp_http_client_get_status_code(client) == 200;
    if (ok) {
        if (response_body.overflow || response_body.length == 0) {
            ok = false;
        } else {
            cJSON* root = cJSON_ParseWithLength(response.data(), response_body.length);
            const cJSON* credential = root == nullptr
                                          ? nullptr
                                          : cJSON_GetObjectItemCaseSensitive(root, "credential");
            const cJSON* device_id = root == nullptr
                                         ? nullptr
                                         : cJSON_GetObjectItemCaseSensitive(root, "device_id");
            ok = cJSON_IsString(credential) && cJSON_IsString(device_id) &&
                 std::strcmp(device_id->valuestring, storage_.device_id().c_str()) == 0;
            if (ok) {
                // The endpoint callback can replace a pending claim while the
                // HTTPS request is in flight. Commit only the same claim.
                lock();
                const bool same_claim = claim_pending_.load() && claim_id_ == claim_id &&
                                        challenge_ == challenge;
                ok = same_claim && storage_.set_operational_token(credential->valuestring);
                unlock();
            }
            cJSON_Delete(root);
        }
    }
    (void)esp_http_client_cleanup(client);
    if (ok) {
        lock();
        claim_pending_.store(false);
        claim_id_.clear();
        challenge_.clear();
        active_.store(false);
        unlock();
        (void)storage_.erase_cloud_credentials();
        wifi_prov_mgr_stop_provisioning();
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        (void)device_state_.cloud_claimed();
    }
    return ok;
}
#endif

void ProvisioningManager::tick(std::uint64_t now_ms) {
#ifdef ESP_PLATFORM
    if (!active_.load()) return;
    if (started_at_ms_ == 0) started_at_ms_ = now_ms;
    if (now_ms - started_at_ms_ >= kProvisioningWindowMs) {
        lock();
        active_.store(false);
        claim_pending_.store(false);
        claim_id_.clear();
        challenge_.clear();
        started_at_ms_ = 0;
        next_claim_attempt_ms_ = 0;
        wifi_prov_mgr_stop_provisioning();
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        unlock();
        (void)device_state_.reset_provisioning();
        return;
    }
    if (claim_pending_.load() && now_ms >= next_claim_attempt_ms_) {
        next_claim_attempt_ms_ = now_ms + 2'000;
        (void)confirm_cloud_claim();
    }
#else
    (void)now_ms;
#endif
}

bool ProvisioningManager::physical_restart() {
#ifdef ESP_PLATFORM
    if (active_) return false;
    lock();
    claim_pending_.store(false);
    claim_id_.clear();
    challenge_.clear();
    started_at_ms_ = 0;
    next_claim_attempt_ms_ = 0;
    manager_initialized_ = false;
    unlock();
    if (!device_state_.reset_provisioning().accepted) return false;
    wifi_prov_mgr_config_t config = {};
    config.scheme = wifi_prov_scheme_ble;
    config.scheme_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    config.app_event_handler = WIFI_PROV_EVENT_HANDLER_NONE;
    if (wifi_prov_mgr_init(config) != ESP_OK) {
        return false;
    }
    manager_initialized_ = true;
    if (wifi_prov_mgr_reset_provisioning() != ESP_OK || wifi_prov_mgr_endpoint_create(kEndpoint) != ESP_OK) {
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        return false;
    }
    if (!start_service()) {
        wifi_prov_mgr_deinit();
        manager_initialized_ = false;
        return false;
    }
    return true;
#else
    return false;
#endif
}

std::string ProvisioningManager::qr_payload() const {
    return "{\"v\":1,\"device_id\":\"" + storage_.device_id() +
           "\",\"pop\":\"" + storage_.local_pop() + "\"}";
}

}  // namespace soba::provisioning
