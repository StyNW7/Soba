# Hardware

The production board, battery, microphone, and enclosure are still open
decisions. The firmware host protocol is implemented and can be tested without
the physical doll.

## Backend device contract

- Device enrollment creates a unique factory bootstrap hash. The bootstrap
  secret is delivered through the offline admin command and stored outside the
  repository with mode `0600`.
- Owner pairing proves both cloud device identity and local physical access.
- After pairing, the device uses its operational bearer credential. It never
  receives Deepgram, OpenAI, FCM, or database credentials.
- Voice input is 16 kHz, 16-bit signed little-endian mono PCM. Each input frame
  carries a 4-byte big-endian sequence. Output is 24 kHz mono PCM with a
  response sequence so the device can discard late audio after a local stop.
- The device must show listening, processing, speaking, paused, and error
  states. A local stop or mute action must stop capture and playback without
  waiting for a cloud response.

## Candidate electronics

An ESP32-S3 remains the working candidate because it has native I2S, low power,
small size, and fast wake. An I2S MEMS microphone such as INMP441 or SPH0645
and an I2S amplifier such as MAX98357A are candidate parts only. A Raspberry Pi
Zero 2 W is an evaluation alternative with easier Linux audio and higher power
use.

No part is approved until it passes the following checks:

- speech capture from the intended distance and plush placement;
- playback level that is clear and not startling;
- Wi-Fi loss, reconnect, sequence-gap, and late-audio behaviour;
- local mute/stop and visible listening indicator;
- battery, charge, thermal, cable strain, and enclosure safety review;
- secure provisioning, credential revocation, and OTA rollback;
- child-safe materials and access to the battery and electronics.

## Development without hardware

Use the browser or a host protocol test as the audio source. The backend does
not require a board to validate ownership, safety ordering, retention, or
provider cancellation. The host tests run with CMake:

```bash
cd iot/host_tests
cmake -S . -B build
cmake --build build
ctest --test-dir build --output-on-failure
```
