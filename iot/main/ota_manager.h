#pragma once

#include <cstdint>
#include <string>

namespace soba::ota {

struct OtaManifest {
    std::string version;
    std::string image_url;
    std::string sha256_hex;
    std::string hardware_revision;
    std::uint32_t minimum_protocol = 0;
    std::string signature_base64;
};

class OtaManager final {
   public:
    bool init();
    bool mark_boot_healthy(bool self_tests_passed);
    // When enabled in a reviewed release, check the build-configured private
    // manifest while the device is idle and reboot only after verification.
    void poll(std::uint64_t now_ms);
    bool apply_manifest_json(const std::string& json);
    bool rollback_and_reboot();

   private:
#ifdef ESP_PLATFORM
    bool parse_manifest(const std::string& json, OtaManifest* manifest) const;
    bool verify_manifest(const OtaManifest& manifest) const;
    bool download_and_install(const OtaManifest& manifest) const;
    bool fetch_manifest(std::string* json) const;
#endif
    bool initialized_ = false;
    std::uint64_t next_poll_ms_ = 0;
};

}  // namespace soba::ota
