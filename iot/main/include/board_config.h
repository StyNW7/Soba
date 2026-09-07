#pragma once

// This header is the single board boundary. GPIO values come from Kconfig and
// default to -1, so a reference build cannot silently drive an unknown pin.
#include "sdkconfig.h"

#define SOBA_GPIO_UNUSED (-1)

namespace soba::board {

constexpr int kMicBclkGpio = CONFIG_SOBA_MIC_BCLK_GPIO;
constexpr int kMicWsGpio = CONFIG_SOBA_MIC_WS_GPIO;
constexpr int kMicDataGpio = CONFIG_SOBA_MIC_DATA_GPIO;
constexpr int kSpeakerBclkGpio = CONFIG_SOBA_SPK_BCLK_GPIO;
constexpr int kSpeakerWsGpio = CONFIG_SOBA_SPK_WS_GPIO;
constexpr int kSpeakerDataGpio = CONFIG_SOBA_SPK_DATA_GPIO;
constexpr int kMicMuteGpio = CONFIG_SOBA_MIC_MUTE_GPIO;
constexpr int kStopGpio = CONFIG_SOBA_STOP_GPIO;
constexpr int kStartGpio = CONFIG_SOBA_START_GPIO;
constexpr int kEndTurnGpio = CONFIG_SOBA_END_TURN_GPIO;
constexpr int kStatusLedGpio = CONFIG_SOBA_STATUS_LED_GPIO;
constexpr int kProvisionButtonGpio = CONFIG_SOBA_PROVISION_BUTTON_GPIO;

constexpr int kMicActiveLevel = CONFIG_SOBA_MIC_ACTIVE_LEVEL;
constexpr int kStopActiveLevel = CONFIG_SOBA_STOP_ACTIVE_LEVEL;
constexpr int kStartActiveLevel = CONFIG_SOBA_START_ACTIVE_LEVEL;
constexpr int kEndTurnActiveLevel = CONFIG_SOBA_END_TURN_ACTIVE_LEVEL;
constexpr int kProvisionActiveLevel = CONFIG_SOBA_PROVISION_ACTIVE_LEVEL;
constexpr int kMicSampleShift = CONFIG_SOBA_MIC_SAMPLE_SHIFT;
constexpr int kMicSampleBits = CONFIG_SOBA_MIC_SAMPLE_BITS;

constexpr bool audio_pins_configured() {
    return kMicBclkGpio >= 0 && kMicWsGpio >= 0 && kMicDataGpio >= 0 &&
           kSpeakerBclkGpio >= 0 && kSpeakerWsGpio >= 0 && kSpeakerDataGpio >= 0;
}

}  // namespace soba::board
