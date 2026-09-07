#pragma once

#include "preferences_store.h"
#include "protocol/state_machine.h"

#include <cstdint>
#include <atomic>
#include <string>

#ifdef ESP_PLATFORM
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <sys/types.h>
#endif

namespace soba::provisioning {

class ProvisioningManager final {
   public:
    ProvisioningManager(storage::PreferencesStore& storage,
                        protocol::DeviceStateMachine& device_state);
    ~ProvisioningManager();

    bool init();
    void tick(std::uint64_t now_ms);
    bool active() const { return active_.load(); }
    bool physical_restart();
    std::string qr_payload() const;

   private:
#ifdef ESP_PLATFORM
    static esp_err_t claim_endpoint(std::uint32_t session_id, const std::uint8_t* inbuf,
                                    ssize_t inlen, std::uint8_t** outbuf, ssize_t* outlen,
                                    void* priv_data);
    static bool strict_claim_payload(const std::uint8_t* inbuf, ssize_t inlen,
                                     std::string* claim_id, std::string* challenge);
    bool start_service();
    bool confirm_cloud_claim();
    void lock() const;
    void unlock() const;
#endif
    bool ensure_local_pop();

    storage::PreferencesStore& storage_;
    protocol::DeviceStateMachine& device_state_;
    std::atomic<bool> active_{false};
    bool manager_initialized_ = false;
    std::atomic<bool> claim_pending_{false};
    std::string claim_id_;
    std::string challenge_;
    std::uint64_t started_at_ms_ = 0;
    std::uint64_t next_claim_attempt_ms_ = 0;
#ifdef ESP_PLATFORM
    mutable SemaphoreHandle_t mutex_ = nullptr;
#endif
};

}  // namespace soba::provisioning
