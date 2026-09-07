# Firmware setup, NVS handling, and release gates

This document is part of the firmware handoff. It records the commands and
checks needed to turn the reference source into a device image. It does not
approve a board, battery, charger, provider, or production deployment.

## Isolated ESP-IDF toolchain

The reference build uses ESP-IDF 5.3.2 for ESP32-S3. Keep the checkout and
Espressif tools below `iot/work/`; do not install into the user's global shell.

```sh
mkdir -p work
git clone --depth 1 --branch v5.3.2 https://github.com/espressif/esp-idf.git work/esp-idf
work/esp-idf/install.sh esp32s3
source work/esp-idf/export.sh
idf.py --version
```

If the host cannot download the toolchain, record that fact and run the host
tests. A host pass is not an ESP-IDF compile or a hardware result.

## Board configuration

Start with a clean reference configuration:

```sh
idf.py set-target esp32s3
idf.py reconfigure
idf.py menuconfig
```

Set all values under `SOBA reference firmware`:

1. Replace both example HTTPS/WSS URIs with the private deployment endpoints.
2. Set the reviewed hardware revision and protocol version.
3. Set all microphone and speaker I2S pins from the released schematic.
4. Set the physical start, end-turn, mute, stop, provisioning button, and status LED pins.
5. Measure the selected microphone with a known signed waveform. Set its sample
   shift and bit width. A common INMP441 module uses a shift of eight, but this
   source does not assume that is correct for every board.
6. Set the OTA public key and manifest URI only in a release configuration. The
   private signing key stays in the release system.
7. Keep OTA disabled until signed-image and rollback tests pass. When enabled,
   the runtime polls only this build-configured manifest while idle, verifies
   the complete image, selects the alternate slot, and reboots.

There are no battery settings in this firmware. Battery percentage is accepted
only from a board-specific calibrated reader installed by the hardware owner.
Without that reader, heartbeat is deferred; the firmware does not report a
guessed battery value.

Heartbeat HTTPS work is deferred while WSS is connected or audio is active.
This keeps the 10 ms physical mute and stop poll independent of a slow API
request. Device status can therefore be stale while the WSS session is active;
the next idle window sends the heartbeat. The battery value can remain stale
for the same period; the server-side live socket presence signal does not
replace that battery value.

## Secret-safe NVS and manufacturing

The `nvs_keys` partition is separate from the normal NVS partition and is marked
encrypted in `partitions.csv`. The reference defaults keep NVS encryption off so
the source can compile without silently selecting a flash or eFuse security
policy; `CONFIG_SOBA_REQUIRE_ENCRYPTED_NVS=y` then fails startup closed. A
release configuration must enable `CONFIG_NVS_ENCRYPTION` and select a reviewed
ESP32-S3 key-protection scheme and eFuse/flash-encryption policy before writing
credentials. Runtime key generation is deliberately not used: a recovery image
must not be able to replace the device trust root.

Manufacturing must provision the NVS key partition through a controlled station,
then write the factory credential into encrypted NVS. The factory credential is
accepted only for `/v1/device-claims/{id}/confirm`; after a successful claim the
firmware erases it. The operational bearer credential is stored only in encrypted
NVS and is used only in the WSS `Authorization` header and device heartbeat.

The local BLE PoP is a separate per-device secret. It is included only in the
physical QR/manual pairing payload and never sent to the cloud. Wi-Fi credentials
remain in Espressif's protected provisioning storage. Do not print any of these
values, include them in crash reports, put them in URLs, or add them to test
fixtures. A factory reset requires a reviewed physical recovery procedure.

## Provisioning and claim sequence

1. On an unclaimed device, secure BLE provisioning advertises a service name and
   the local payload `{"v":1,"device_id":"UUID","pop":"DEVICE_LOCAL_SECRET"}`.
2. The mobile provisioning bridge authenticates with the PoP and sends Wi-Fi
   credentials through the native Espressif provisioning API.
3. The authenticated local `soba-claim` endpoint receives exactly
   `{claim_id,challenge}`. Unknown JSON fields are rejected.
4. After network setup, the device posts the challenge to
   `/v1/device-claims/{claim_id}/confirm` with the factory credential.
5. The device verifies the returned device ID, stores the operational credential
   in encrypted NVS, erases the factory credential, and stops BLE provisioning.
6. Provisioning expires after five minutes. Restart requires the physical
   provisioning action; the firmware keeps BLE memory so this restart works
   without a reboot. A public QR payload alone cannot reclaim a device.

## Release gates

The following evidence is required before a sewn-in pilot unit:

- `cmake` host tests pass and the ESP-IDF build has no warnings that affect
  transport, audio, storage, or OTA.
- JSON events and binary frames validate against
  `../docs/implementation/contracts/voice-events.schema.json` and the v1 voice
  specification. Control frames stay at or below 16 KiB; input frames are
  exactly 644 bytes and output frames are bounded to 9,608 bytes.
- A known waveform proves microphone sign/shift conversion. Capture is verified
  as 16 kHz mono S16LE and playback as 24 kHz mono S16LE.
- A real local stop request flushes capture and speaker DMA within 200 ms. The
  reference path uses four 10 ms speaker DMA descriptors, 20 ms write waits,
  and bounded partial-write retries; the board test must still measure the
  actual stop edge. Mute
  blocks new capture before any network handling. The LED states are verified
  without relying on color perception. A physical start is required for every
  new session or turn; reconnect never starts capture. If an end-turn button is
  fitted, it sends `input.end` and waits for the server final event.
- BLE PoP rejection, wrong claim challenge, expired claim, concurrent claim, and
  one-owner binding are tested. Credential values do not appear in logs.
- Wi-Fi loss, WSS reconnect, heartbeat timeout, sequence gap, oversized control
  frame, cancelled response, and late audio are tested. A reconnect starts a new
  session and never replays an old frame.
- A signed manifest with matching hardware/protocol passes; bad signature,
  wrong revision, old protocol, wrong digest, non-HTTPS URL, and oversized image
  fail. The image boots from the alternate OTA slot, confirms with
  `esp_ota_mark_app_valid_cancel_rollback`, and rolls back with
  `esp_ota_mark_app_invalid_rollback_and_reboot` after a failed self-test.
- The chosen battery, charger, protection circuit, enclosure, speaker level,
  heat, charging, drop, chew, and sleep tests are approved by the hardware owner.
- End-to-end voice tests measure p50/p95 latency, Indonesian speech, code-switching,
  pauses, background TV, and the actual plush acoustics. The target is p50 ≤2 s
  and p95 ≤4 s after end of speech. Firmware tests do not establish provider or
  clinical quality.

Hardware validation was not performed for this reference source because no board
or electrical design was supplied.
