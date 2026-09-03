# IoT — the doll

Firmware for the Soba doll: capture what the user says, send it to the backend, speak the
reply back.

**Status: blocked.** No hardware has been chosen, so there is no firmware and no toolchain
here yet. This directory is a placeholder holding the requirements.

## Read this first

[`../docs/hardware.md`](../docs/hardware.md) — what the board has to be able to do, the
candidates under consideration, and the six decisions that block firmware work.

Nothing should be written here until at least the board, the mic and amp, and the wake
behaviour are settled.

## What the firmware will own

- **Capture** — I2S microphone, mono PCM at the rate the speech pipeline expects (assume
  16 kHz / 16-bit until confirmed; see
  [`../docs/speech-pipeline.md`](../docs/speech-pipeline.md)).
- **Wake** — deciding when the user is actually talking to the doll: voice activity
  detection, a wake word, or a physical touch. Undecided, and it is a privacy decision as
  much as a technical one.
- **Listening indicator** — a visible, unambiguous signal that the doll is recording.
  Required, not a nice-to-have.
- **Transport** — stream audio to the backend and receive reply audio. Protocol is
  [open question 1](../docs/architecture.md#open-questions).
- **Playback** — I2S amplifier into the speaker, at a volume that is audible but never
  startling.
- **Physical feedback** — whatever light, haptics, or movement the doll uses to feel present.
- **OTA updates** — firmware updates over Wi-Fi. The doll gets sewn shut; assume you cannot
  reach the board again.

## What the firmware must not do

- **No third-party API keys on the device.** It authenticates to our backend and nothing
  else. A doll can be opened with scissors — treat anything flashed to it as public.
- **No conversation state or judgement about what the user said.** That lives in the backend
  where it can be fixed without reflashing anything, or anyone having to unstitch a toy.

## Not a blocker for anyone else

The backend accepts audio from ordinary clients, so the full pipeline can be built and
tested without a doll. Treat the hardware as one audio source among several rather than a
prerequisite for the rest of the project.
