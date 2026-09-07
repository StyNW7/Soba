#pragma once

#include "audio_pipeline.h"
#include "controls.h"
#include "ota_manager.h"
#include "preferences_store.h"
#include "provisioning.h"
#include "protocol/state_machine.h"
#include "telemetry.h"
#include "transport_client.h"

#include <cstdint>
#include <atomic>

namespace soba {

class DeviceRuntime final {
   public:
    DeviceRuntime();
    bool init();
    void run();

    audio::AudioPipeline& audio() { return audio_; }
    transport::TransportClient& transport() { return transport_; }
    provisioning::ProvisioningManager& provisioning() { return provisioning_; }

   private:
#ifdef ESP_PLATFORM
    static void wifi_event(void* arg, esp_event_base_t event_base, std::int32_t event_id,
                           void* event_data);
    void on_wifi_event(esp_event_base_t event_base, std::int32_t event_id, void* event_data);
    bool init_network();
    bool network_time_ready() const;
#endif
    void on_transport_connected();
    void on_transport_ready();
    void on_transport_closed();
    void on_transport_error(const char* code);
    void poll(std::uint64_t now_ms);

    storage::PreferencesStore storage_;
    protocol::DeviceStateMachine device_state_;
    controls::HardwareControls controls_;
    audio::AudioPipeline audio_;
    provisioning::ProvisioningManager provisioning_;
    telemetry::DeviceTelemetry telemetry_;
    transport::TransportClient transport_;
    ota::OtaManager ota_;
    bool initialized_ = false;
    std::atomic<bool> network_ready_{false};
    std::atomic<bool> start_pending_{false};
    bool transport_initialized_ = false;
    std::atomic<bool> time_sync_started_{false};
    std::atomic<bool> time_synced_{false};
    std::atomic<std::uint64_t> next_connect_ms_{0};
    std::atomic<std::uint32_t> connect_backoff_ms_{1'000};
};

}  // namespace soba
