#include "ota_manager.h"

#ifdef ESP_PLATFORM
#include "cJSON.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "mbedtls/base64.h"
#include "mbedtls/md.h"
#include "mbedtls/pk.h"
#include "mbedtls/sha256.h"
#include "sdkconfig.h"
#endif

#include <array>
#include <cctype>
#include <cmath>
#include <cstring>
#include <limits>

namespace soba::ota {

namespace {
constexpr char kTag[] = "soba.ota";
constexpr std::size_t kSha256HexLength = 64;
constexpr std::size_t kMaxManifestBytes = 4096;
constexpr std::uint64_t kManifestPollPeriodMs = 6 * 60 * 60 * 1000;
}

bool OtaManager::init() {
#ifdef ESP_PLATFORM
    const esp_partition_t* running = esp_ota_get_running_partition();
    if (running == nullptr) return false;
    initialized_ = true;
    return true;
#else
    return false;
#endif
}

bool OtaManager::mark_boot_healthy(bool self_tests_passed) {
#ifdef ESP_PLATFORM
    if (!initialized_) return false;
    esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
    const esp_partition_t* running = esp_ota_get_running_partition();
    if (running == nullptr || esp_ota_get_state_partition(running, &state) != ESP_OK) return false;
    if (state == ESP_OTA_IMG_PENDING_VERIFY) {
        if (!self_tests_passed) return rollback_and_reboot();
        return esp_ota_mark_app_valid_cancel_rollback() == ESP_OK;
    }
    return true;
#else
    (void)self_tests_passed;
    return false;
#endif
}

void OtaManager::poll(std::uint64_t now_ms) {
#ifdef ESP_PLATFORM
#if CONFIG_SOBA_OTA_ENABLED
    if (!initialized_ || now_ms < next_poll_ms_) return;
    next_poll_ms_ = now_ms + kManifestPollPeriodMs;
    std::string manifest;
    if (!fetch_manifest(&manifest)) return;
    if (!apply_manifest_json(manifest)) {
        ESP_LOGW(kTag, "OTA manifest or image verification failed");
        return;
    }
    ESP_LOGI(kTag, "verified OTA image; rebooting into the alternate slot");
    esp_restart();
#else
    (void)now_ms;
#endif
#else
    (void)now_ms;
#endif
}

bool OtaManager::apply_manifest_json(const std::string& json) {
#ifdef ESP_PLATFORM
#if CONFIG_SOBA_OTA_ENABLED
    if (!initialized_ || json.empty() || json.size() > kMaxManifestBytes) return false;
    OtaManifest manifest;
    return parse_manifest(json, &manifest) && verify_manifest(manifest) &&
           download_and_install(manifest);
#else
    (void)json;
    return false;
#endif
#else
    (void)json;
    return false;
#endif
}

bool OtaManager::rollback_and_reboot() {
#ifdef ESP_PLATFORM
    if (!initialized_) return false;
    // This API never returns on success. It is intentionally kept in the
    // reference path so watchdog rollback is part of the firmware, not a
    // release note promise.
    const esp_err_t err = esp_ota_mark_app_invalid_rollback_and_reboot();
    // A successful call reboots and does not return. Any return is an API
    // failure, including an ESP_OK value from a test double.
    ESP_LOGE(kTag, "OTA rollback did not reboot: %s", esp_err_to_name(err));
    return false;
#else
    return false;
#endif
}

#ifdef ESP_PLATFORM
bool OtaManager::parse_manifest(const std::string& json, OtaManifest* manifest) const {
    if (manifest == nullptr) return false;
    cJSON* root = cJSON_ParseWithLength(json.data(), json.size());
    if (root == nullptr || !cJSON_IsObject(root) || cJSON_GetArraySize(root) != 6) {
        cJSON_Delete(root);
        return false;
    }
    const cJSON* version = cJSON_GetObjectItemCaseSensitive(root, "version");
    const cJSON* image_url = cJSON_GetObjectItemCaseSensitive(root, "image_url");
    const cJSON* sha256 = cJSON_GetObjectItemCaseSensitive(root, "sha256");
    const cJSON* hardware = cJSON_GetObjectItemCaseSensitive(root, "hardware_revision");
    const cJSON* minimum = cJSON_GetObjectItemCaseSensitive(root, "min_protocol");
    const cJSON* signature = cJSON_GetObjectItemCaseSensitive(root, "signature");
    const bool valid_minimum = cJSON_IsNumber(minimum) &&
                               std::isfinite(minimum->valuedouble) &&
                               minimum->valuedouble >= 0.0 &&
                               minimum->valuedouble <=
                                   static_cast<double>(std::numeric_limits<std::uint32_t>::max()) &&
                               std::floor(minimum->valuedouble) == minimum->valuedouble;
    const bool valid = cJSON_IsString(version) && cJSON_IsString(image_url) &&
                       cJSON_IsString(sha256) && cJSON_IsString(hardware) && valid_minimum &&
                       cJSON_IsString(signature);
    if (valid) {
        manifest->version = version->valuestring;
        manifest->image_url = image_url->valuestring;
        manifest->sha256_hex = sha256->valuestring;
        manifest->hardware_revision = hardware->valuestring;
        manifest->minimum_protocol = static_cast<std::uint32_t>(minimum->valuedouble);
        manifest->signature_base64 = signature->valuestring;
    }
    cJSON_Delete(root);
    return valid;
}

bool OtaManager::fetch_manifest(std::string* json) const {
    if (json == nullptr) return false;
    const std::string endpoint = CONFIG_SOBA_OTA_MANIFEST_URI;
    if (endpoint.rfind("https://", 0) != 0 || endpoint.size() > 512) return false;

    esp_http_client_config_t config = {};
    config.url = endpoint.c_str();
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.disable_auto_redirect = true;
    config.timeout_ms = 5'000;
    config.buffer_size = 2048;
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == nullptr || esp_http_client_open(client, 0) != ESP_OK) {
        if (client != nullptr) (void)esp_http_client_cleanup(client);
        return false;
    }
    const int content_length = esp_http_client_fetch_headers(client);
    const int status_code = esp_http_client_get_status_code(client);
    bool ok = status_code == 200 && content_length != 0 &&
              (content_length < 0 || static_cast<std::size_t>(content_length) <= kMaxManifestBytes);
    std::array<char, kMaxManifestBytes + 1> response{};
    std::size_t length = 0;
    while (ok) {
        const int read = esp_http_client_read(client, response.data() + length,
                                              kMaxManifestBytes - length);
        if (read < 0) {
            ok = false;
            break;
        }
        if (read == 0) {
            ok = content_length < 0 || length == static_cast<std::size_t>(content_length);
            break;
        }
        length += static_cast<std::size_t>(read);
        if (content_length >= 0 && length > static_cast<std::size_t>(content_length)) {
            ok = false;
            break;
        }
        if (length == kMaxManifestBytes) {
            if (content_length >= 0) {
                ok = length == static_cast<std::size_t>(content_length);
            } else {
                char extra = '\0';
                const int extra_read = esp_http_client_read(client, &extra, 1);
                ok = extra_read == 0;
            }
            break;
        }
    }
    (void)esp_http_client_close(client);
    (void)esp_http_client_cleanup(client);
    if (!ok || length == 0) return false;
    response[length] = '\0';
    json->assign(response.data(), length);
    return true;
}

bool OtaManager::verify_manifest(const OtaManifest& manifest) const {
    if (manifest.version.empty() || manifest.version.size() > 40 ||
        manifest.image_url.rfind("https://", 0) != 0 || manifest.image_url.size() > 512 ||
        manifest.hardware_revision != CONFIG_SOBA_HARDWARE_REVISION ||
        manifest.minimum_protocol > CONFIG_SOBA_PROTOCOL_VERSION ||
        manifest.sha256_hex.size() != kSha256HexLength || manifest.signature_base64.empty() ||
        std::strlen(CONFIG_SOBA_OTA_PUBLIC_KEY_PEM) == 0) {
        return false;
    }
    for (const char c : manifest.sha256_hex) {
        if (!std::isxdigit(static_cast<unsigned char>(c))) return false;
    }
    std::string canonical = manifest.version + "\n" + manifest.image_url + "\n" +
                            manifest.sha256_hex + "\n" + manifest.hardware_revision + "\n" +
                            std::to_string(manifest.minimum_protocol);
    std::array<std::uint8_t, 32> digest{};
    mbedtls_sha256_context sha;
    mbedtls_sha256_init(&sha);
    if (mbedtls_sha256_starts(&sha, 0) != 0 ||
        mbedtls_sha256_update(&sha, reinterpret_cast<const std::uint8_t*>(canonical.data()),
                              canonical.size()) != 0 ||
        mbedtls_sha256_finish(&sha, digest.data()) != 0) {
        mbedtls_sha256_free(&sha);
        return false;
    }
    mbedtls_sha256_free(&sha);

    std::array<std::uint8_t, 512> signature{};
    std::size_t signature_length = 0;
    if (mbedtls_base64_decode(signature.data(), signature.size(), &signature_length,
                              reinterpret_cast<const std::uint8_t*>(manifest.signature_base64.data()),
                              manifest.signature_base64.size()) != 0) {
        return false;
    }
    mbedtls_pk_context key;
    mbedtls_pk_init(&key);
    const auto* pem = reinterpret_cast<const std::uint8_t*>(CONFIG_SOBA_OTA_PUBLIC_KEY_PEM);
    const int parse_error = mbedtls_pk_parse_public_key(&key, pem,
                                                        std::strlen(CONFIG_SOBA_OTA_PUBLIC_KEY_PEM) + 1);
    const int verify_error = parse_error == 0
                                 ? mbedtls_pk_verify(&key, MBEDTLS_MD_SHA256, digest.data(), digest.size(),
                                                     signature.data(), signature_length)
                                 : -1;
    mbedtls_pk_free(&key);
    return verify_error == 0;
}

bool OtaManager::download_and_install(const OtaManifest& manifest) const {
    esp_http_client_config_t config = {};
    config.url = manifest.image_url.c_str();
    config.crt_bundle_attach = esp_crt_bundle_attach;
    config.disable_auto_redirect = true;
    config.timeout_ms = 10'000;
    config.buffer_size = 4096;
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == nullptr || esp_http_client_open(client, 0) != ESP_OK) {
        if (client != nullptr) esp_http_client_cleanup(client);
        return false;
    }
    const int content_length = esp_http_client_fetch_headers(client);
    const int status_code = esp_http_client_get_status_code(client);
    const esp_partition_t* partition = esp_ota_get_next_update_partition(nullptr);
    esp_ota_handle_t handle = 0;
    bool ota_started = false;
    bool ok = status_code == 200 && partition != nullptr && content_length != 0 &&
              (content_length < 0 || static_cast<std::size_t>(content_length) <= partition->size);
    if (ok) {
        ok = esp_ota_begin(partition, OTA_SIZE_UNKNOWN, &handle) == ESP_OK;
        ota_started = ok;
    }
    mbedtls_sha256_context sha;
    mbedtls_sha256_init(&sha);
    if (ota_started) ok = mbedtls_sha256_starts(&sha, 0) == 0;
    std::array<std::uint8_t, 4096> buffer{};
    std::size_t total_read = 0;
    while (ok) {
        const int read = esp_http_client_read(client, reinterpret_cast<char*>(buffer.data()), buffer.size());
        if (read < 0) {
            ok = false;
            break;
        }
        if (read == 0) {
            ok = content_length < 0 || total_read == static_cast<std::size_t>(content_length);
            break;
        }
        total_read += static_cast<std::size_t>(read);
        if (content_length >= 0 && total_read > static_cast<std::size_t>(content_length)) {
            ok = false;
            break;
        }
        ok = mbedtls_sha256_update(&sha, buffer.data(), read) == 0 &&
             esp_ota_write(handle, buffer.data(), read) == ESP_OK;
    }
    std::array<std::uint8_t, 32> digest{};
    if (ok) ok = total_read > 0 && mbedtls_sha256_finish(&sha, digest.data()) == 0;
    mbedtls_sha256_free(&sha);
    (void)esp_http_client_close(client);
    (void)esp_http_client_cleanup(client);
    if (ota_started) {
        if (!ok) {
            (void)esp_ota_abort(handle);
            return false;
        }
        if (esp_ota_end(handle) != ESP_OK) {
            (void)esp_ota_abort(handle);
            return false;
        }
    }
    if (!ok) return false;
    constexpr char hex[] = "0123456789abcdef";
    std::string actual;
    actual.reserve(kSha256HexLength);
    for (const std::uint8_t byte : digest) {
        actual.push_back(hex[byte >> 4]);
        actual.push_back(hex[byte & 0x0fU]);
    }
    if (actual != manifest.sha256_hex) return false;
    if (esp_ota_set_boot_partition(partition) != ESP_OK) return false;
    ESP_LOGI(kTag, "verified OTA image; reboot is required to activate it");
    return true;
}
#endif

}  // namespace soba::ota
