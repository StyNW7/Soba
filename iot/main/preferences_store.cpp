#include "preferences_store.h"

#ifdef ESP_PLATFORM
#include "esp_random.h"
#include "esp_system.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "sdkconfig.h"
#endif

#include <array>
#include <cstdio>

namespace soba::storage {

#ifdef ESP_PLATFORM
namespace {
constexpr char kNamespace[] = "soba";
constexpr char kDeviceIdKey[] = "device_id";
constexpr char kLocalPopKey[] = "local_pop";
constexpr char kOperationalTokenKey[] = "op_token";
constexpr char kFactoryCredentialKey[] = "factory_cred";
constexpr char kLocaleKey[] = "locale";
constexpr char kPersonalityKey[] = "personality";
constexpr char kVoiceKey[] = "voice";
constexpr char kListenFirstKey[] = "listen_first";
constexpr char kMemoryEnabledKey[] = "memory_enabled";
constexpr char kPreferencesVersionKey[] = "prefs_ver";

bool open_store(nvs_handle_t* handle, nvs_open_mode_t mode) {
    return handle != nullptr && nvs_open(kNamespace, mode, handle) == ESP_OK;
}

std::string read_string(nvs_handle_t handle, const char* key) {
    std::size_t length = 0;
    if (nvs_get_str(handle, key, nullptr, &length) != ESP_OK || length == 0 || length > 4096) {
        return {};
    }
    std::string value(length, '\0');
    if (nvs_get_str(handle, key, value.data(), &length) != ESP_OK) return {};
    value.resize(length > 0 ? length - 1 : 0);
    return value;
}
}
#endif

bool PreferencesStore::init() {
#ifdef ESP_PLATFORM
    esp_err_t err = ESP_FAIL;
#if CONFIG_NVS_ENCRYPTION
    nvs_sec_cfg_t security = {};
    // The key partition is provisioned during manufacturing. Generating keys
    // at runtime would make a recovery image able to replace the trust root,
    // so the reference firmware fails closed when it is absent.
    err = nvs_flash_read_security_cfg(&security);
    if (err == ESP_OK) {
        err = nvs_flash_secure_init(&security);
    }
#else
    err = nvs_flash_init();
#endif
    if (err != ESP_OK) {
#if CONFIG_SOBA_REQUIRE_ENCRYPTED_NVS
        initialized_ = false;
        secure_storage_ready_ = false;
        return false;
#else
        if (nvs_flash_init() != ESP_OK) return false;
#endif
    }
#if CONFIG_NVS_ENCRYPTION
    secure_storage_ready_ = true;
#else
    secure_storage_ready_ = false;
#endif
    if (!secure_storage_ready_ && CONFIG_SOBA_REQUIRE_ENCRYPTED_NVS) return false;
    initialized_ = ensure_device_id();
    return initialized_;
#else
    initialized_ = false;
    secure_storage_ready_ = false;
    return false;
#endif
}

bool PreferencesStore::ensure_device_id() {
#ifdef ESP_PLATFORM
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const std::string existing = read_string(handle, kDeviceIdKey);
    if (!existing.empty()) {
        nvs_close(handle);
        return true;
    }
    std::array<std::uint8_t, 16> bytes{};
    esp_fill_random(bytes.data(), bytes.size());
    bytes[6] = static_cast<std::uint8_t>((bytes[6] & 0x0fU) | 0x40U);
    bytes[8] = static_cast<std::uint8_t>((bytes[8] & 0x3fU) | 0x80U);
    char id[37] = {};
    std::snprintf(id, sizeof(id),
                  "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
                  bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6],
                  bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13],
                  bytes[14], bytes[15]);
    const bool ok = nvs_set_str(handle, kDeviceIdKey, id) == ESP_OK &&
                    nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok;
#else
    return false;
#endif
}

std::string PreferencesStore::device_id() const {
#ifdef ESP_PLATFORM
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READONLY)) return {};
    const std::string value = read_string(handle, kDeviceIdKey);
    nvs_close(handle);
    return value;
#else
    return {};
#endif
}

std::string PreferencesStore::operational_token() const {
#ifdef ESP_PLATFORM
    nvs_handle_t handle;
    if (!secure_storage_ready_ || !open_store(&handle, NVS_READONLY)) return {};
    const std::string value = read_string(handle, kOperationalTokenKey);
    nvs_close(handle);
    return value;
#else
    return {};
#endif
}

std::string PreferencesStore::local_pop() const {
#ifdef ESP_PLATFORM
    nvs_handle_t handle;
    if (!secure_storage_ready_ || !open_store(&handle, NVS_READONLY)) return {};
    const std::string value = read_string(handle, kLocalPopKey);
    nvs_close(handle);
    return value;
#else
    return {};
#endif
}

std::string PreferencesStore::factory_credential() const {
#ifdef ESP_PLATFORM
    nvs_handle_t handle;
    if (!secure_storage_ready_ || !open_store(&handle, NVS_READONLY)) return {};
    const std::string value = read_string(handle, kFactoryCredentialKey);
    nvs_close(handle);
    return value;
#else
    return {};
#endif
}

bool PreferencesStore::set_operational_token(const std::string& token) {
#ifdef ESP_PLATFORM
    if (!secure_storage_ready_ || token.empty() || token.size() > 2048) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const bool ok = nvs_set_str(handle, kOperationalTokenKey, token.c_str()) == ESP_OK &&
                    nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok;
#else
    (void)token;
    return false;
#endif
}

bool PreferencesStore::set_local_pop(const std::string& pop) {
#ifdef ESP_PLATFORM
    if (!secure_storage_ready_ || pop.empty() || pop.size() > 128) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const bool ok = nvs_set_str(handle, kLocalPopKey, pop.c_str()) == ESP_OK &&
                    nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok;
#else
    (void)pop;
    return false;
#endif
}

bool PreferencesStore::set_factory_credential(const std::string& credential) {
#ifdef ESP_PLATFORM
    if (!secure_storage_ready_ || credential.empty() || credential.size() > 2048) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const bool ok = nvs_set_str(handle, kFactoryCredentialKey, credential.c_str()) == ESP_OK &&
                    nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok;
#else
    (void)credential;
    return false;
#endif
}

bool PreferencesStore::load_preferences(DevicePreferences* preferences) const {
#ifdef ESP_PLATFORM
    if (preferences == nullptr || !initialized_) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READONLY)) return false;
    const std::string locale = read_string(handle, kLocaleKey);
    const std::string personality = read_string(handle, kPersonalityKey);
    const std::string voice = read_string(handle, kVoiceKey);
    std::uint8_t listen_first = 1;
    std::uint8_t memory_enabled = 0;
    std::uint32_t version = 0;
    (void)nvs_get_u8(handle, kListenFirstKey, &listen_first);
    (void)nvs_get_u8(handle, kMemoryEnabledKey, &memory_enabled);
    (void)nvs_get_u32(handle, kPreferencesVersionKey, &version);
    nvs_close(handle);
    if (!locale.empty()) preferences->locale = locale;
    if (!personality.empty()) preferences->personality = personality;
    if (!voice.empty()) preferences->voice = voice;
    preferences->listen_first = listen_first != 0;
    preferences->memory_enabled = memory_enabled != 0;
    preferences->version = version;
    return true;
#else
    (void)preferences;
    return false;
#endif
}

bool PreferencesStore::save_preferences(const DevicePreferences& preferences) {
#ifdef ESP_PLATFORM
    if (!initialized_ || preferences.locale.size() > 16 || preferences.personality.size() > 32 ||
        preferences.voice.size() > 32) {
        return false;
    }
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const bool ok = nvs_set_str(handle, kLocaleKey, preferences.locale.c_str()) == ESP_OK &&
                    nvs_set_str(handle, kPersonalityKey, preferences.personality.c_str()) == ESP_OK &&
                    nvs_set_str(handle, kVoiceKey, preferences.voice.c_str()) == ESP_OK &&
                    nvs_set_u8(handle, kListenFirstKey, preferences.listen_first ? 1 : 0) == ESP_OK &&
                    nvs_set_u8(handle, kMemoryEnabledKey, preferences.memory_enabled ? 1 : 0) == ESP_OK &&
                    nvs_set_u32(handle, kPreferencesVersionKey, preferences.version) == ESP_OK &&
                    nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok;
#else
    (void)preferences;
    return false;
#endif
}

bool PreferencesStore::erase_cloud_credentials() {
#ifdef ESP_PLATFORM
    if (!secure_storage_ready_) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const esp_err_t token_error = nvs_erase_key(handle, kOperationalTokenKey);
    const esp_err_t factory_error = nvs_erase_key(handle, kFactoryCredentialKey);
    const bool ok = (token_error == ESP_OK || token_error == ESP_ERR_NVS_NOT_FOUND) &&
                    (factory_error == ESP_OK || factory_error == ESP_ERR_NVS_NOT_FOUND);
    const bool committed = ok && nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    return ok && committed;
#else
    return false;
#endif
}

bool PreferencesStore::factory_reset() {
#ifdef ESP_PLATFORM
    if (!initialized_) return false;
    nvs_handle_t handle;
    if (!open_store(&handle, NVS_READWRITE)) return false;
    const esp_err_t erased = nvs_erase_all(handle);
    const bool committed = erased == ESP_OK && nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    initialized_ = committed && ensure_device_id();
    return initialized_;
#else
    return false;
#endif
}

}  // namespace soba::storage
