#include "device_runtime.h"

#ifdef ESP_PLATFORM
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#endif

extern "C" void app_main() {
#ifdef ESP_PLATFORM
    static soba::DeviceRuntime runtime;
    if (!runtime.init()) {
        ESP_LOGE("soba", "firmware initialization failed closed");
        while (true) vTaskDelay(pdMS_TO_TICKS(1'000));
    }
    runtime.run();
#endif
}
