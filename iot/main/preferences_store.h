#pragma once

#include <cstdint>
#include <string>

namespace soba::storage {

struct DevicePreferences {
    std::string locale = "id";
    std::string personality = "calm";
    std::string voice = "marin";
    bool listen_first = true;
    bool memory_enabled = false;
    std::uint32_t version = 0;
};

class PreferencesStore final {
   public:
    bool init();
    bool secure_storage_ready() const { return secure_storage_ready_; }

    std::string device_id() const;
    std::string local_pop() const;
    std::string operational_token() const;
    std::string factory_credential() const;
    bool set_local_pop(const std::string& pop);
    bool set_operational_token(const std::string& token);
    bool set_factory_credential(const std::string& credential);
    bool load_preferences(DevicePreferences* preferences) const;
    bool save_preferences(const DevicePreferences& preferences);
    bool erase_cloud_credentials();
    bool factory_reset();

   private:
    bool ensure_device_id();
    bool secure_storage_ready_ = false;
    bool initialized_ = false;
};

}  // namespace soba::storage
