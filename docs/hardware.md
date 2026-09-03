# Hardware

**Status: not decided.** No board has been chosen, and `iot/` stays a placeholder until one
is. This document exists so that decision gets made deliberately rather than by whoever
happens to have a spare board.

## What the doll has to do

Any candidate must be able to:

- **Capture clear speech** from across a room — realistically an I2S MEMS microphone
  (INMP441, SPH0645 or similar), not an analogue electret on an ADC pin.
- **Play audio back** at a volume that is audible but never startling — I2S amplifier
  (MAX98357A or similar) into a small speaker.
- **Reach the network** over Wi-Fi.
- **Run on battery** for a usable stretch, and charge over USB-C without being opened.
- **Fit inside a plush toy** — board, mic, speaker, battery, and wiring, with room for
  stuffing so it still feels like a toy.
- **Stay cool and safe.** This object is hugged, slept next to, and possibly chewed. Battery
  choice, charge circuitry, and enclosure matter more here than on a desk project.
- **Take updates** without surgery — OTA firmware updates over Wi-Fi.

## Candidates

### ESP32-S3

| | |
| - | - |
| Cost | Low |
| Size | Small enough to disappear into a plush |
| Audio | Native I2S in and out; well-trodden path with INMP441 + MAX98357A |
| Power | Genuinely battery-friendly; deep sleep between conversations |
| Toolchain | PlatformIO / ESP-IDF, C++ |
| Weakness | No headroom for on-device TTS or any local model; everything meaningful happens over the network. Wi-Fi dropouts are felt immediately by the user. |

### Raspberry Pi Zero 2 W

| | |
| - | - |
| Cost | Higher |
| Size | Fits, but with the battery it is bulky for a soft toy |
| Audio | Easiest path — standard Linux audio, USB or I2S |
| Power | Hungry; shorter battery life, more heat |
| Toolchain | Python; same language as most speech tooling |
| Weakness | Boot time is seconds, not milliseconds. A companion that takes 20 seconds to wake up is a different product. |

### Rough read

**ESP32-S3 is the better fit for a plush companion** on cost, size, power, and instant wake.
The Pi's advantages — easy audio, local processing — matter less in an architecture where
the backend does the thinking anyway.

This is a recommendation, not a decision. Someone should hold both and try.

## Decide before firmware starts

Firmware work is blocked on all of these:

1. **Which board.**
2. **Which mic and amp**, and where they physically sit in the doll — mic position changes
   capture quality more than any software choice will.
3. **Battery chemistry and capacity**, and the charge circuit. This is the safety-critical
   one.
4. **Wake behaviour**: always listening with on-device voice activity detection, a wake
   word, or a physical touch to start a conversation. This is a privacy decision as much as
   a technical one — an always-on microphone in a bedroom needs to be an explicit, visible
   choice. See [`safety-and-privacy.md`](safety-and-privacy.md).
5. **A visible listening indicator.** The user must be able to tell at a glance whether the
   doll is recording. Non-negotiable, and it constrains the board's spare pins.
6. **Transport to the backend** — see open question 1 in [`architecture.md`](architecture.md).

## Developing without hardware

Nobody should be blocked waiting for a board. The backend must accept audio from an
ordinary client — a script, a phone, a browser tab — so the whole pipeline can be built and
tested before the doll exists. Treat the doll as one audio source among several, not as a
prerequisite.
