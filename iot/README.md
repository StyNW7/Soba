# SOBA ESP32-S3 reference firmware

This directory contains the ESP-IDF reference firmware for the SOBA voice device.
It targets an ESP32-S3 with external RAM, an I2S MEMS microphone, and an I2S
amplifier. The firmware uses 16 kHz mono signed PCM for capture and 24 kHz mono
signed PCM for playback.

The source is a reference build. The final PCB, microphone, amplifier wiring,
battery, charger, enclosure, and wake action are still release decisions. Every
GPIO defaults to `-1`. The firmware refuses to start the audio pipeline until a
reviewed board mapping is supplied. It contains no battery voltage, chemistry,
capacity, charge current, or cutoff setting.

## Layout

- `main/protocol/` contains portable framing and device/session state logic.
- `audio_pipeline.*` owns the two second bounded capture/playback queues and
  ESP-IDF standard I2S channels.
- `provisioning.*` uses Espressif BLE secure provisioning, the `soba-claim`
  endpoint, and the factory-credential cloud claim.
- `transport_client.*` owns WSS authentication, the v1 event contract, exact
  binary framing, heartbeat, cancellation, and no-replay reconnect behavior.
- `controls.*` keeps physical mute/stop authoritative and requires an explicit
  start action before opening WSS; an optional end-turn button sends `input.end`.
- `preferences_store.*` is the encrypted NVS boundary. Secrets are never logged.
- `ota_manager.*` verifies a signed manifest and SHA-256 image, writes a dual OTA
  partition with IDF APIs, polls the build-configured manifest only while idle
  when OTA is enabled, and confirms or rolls back pending images.
- `host_tests/` builds the protocol, framing, control, and lifecycle tests on a
  normal host.

## Host tests

```sh
cmake -S host_tests -B work/host-build -DCMAKE_BUILD_TYPE=Debug
cmake --build work/host-build --parallel
ctest --test-dir work/host-build --output-on-failure
```

The tests cover exact 20 ms and bounded output frames, big-endian fields, signed
microphone conversion, sequence gaps, duplicate event IDs, timeout behavior,
reconnect state reset, local stop/mute debounce, lifecycle transitions, and JSON
escaping.

## ESP-IDF build

Use the isolated toolchain described in
[`docs/firmware-setup-and-release.md`](docs/firmware-setup-and-release.md). In a
configured ESP-IDF shell:

```sh
idf.py set-target esp32s3
idf.py menuconfig
idf.py build
```

Before a device build, set the API URIs, hardware revision, all six I2S pins,
start/end-turn/mute/stop/provision/LED pins, microphone shift/bit settings, and a manufacturing-provided
encrypted NVS key partition. Do not place operational or factory credentials in
`sdkconfig`, source, logs, or QR screenshots.

The default endpoint is an invalid example host, OTA is disabled, and audio pins
are unset. These defaults are intentional fail-closed release gates.

## Hardware and release status

No physical board, microphone, amplifier, battery, charger, or enclosure was
available for this implementation. Therefore no claims are made about microphone
waveform alignment, speaker output, stop latency, Wi-Fi range, power draw,
thermal behavior, BLE pairing, or OTA reboot behavior. The exact physical and
operational gates are listed in the setup and release document.
