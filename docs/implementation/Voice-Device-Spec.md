# Voice, AI, and device implementation specification

Normative for TD 2.0. [voice-events.schema.json](contracts/voice-events.schema.json) defines all 17 JSON events. [Backend-Spec.md](Backend-Spec.md) defines authority and persistence.

## V1. Reference build

Firmware reference target: ESP32-S3 with external RAM, ESP-IDF, I2S microphone and I2S amplifier/speaker. Use a board-specific `board_config.h` for pin assignments; the production PCB and battery are not selected by this software specification. Firmware modules are `provisioning`, `identity`, `capture`, `playback`, `session`, `controls`, `telemetry`, and `ota`.

Capture format is 16 kHz, mono, signed 16-bit little-endian PCM. Playback format is 24 kHz with the same sample type. The I2S input conversion must shift/sign-extend the microphone's native sample correctly; test against a known waveform. Allocate two seconds of capture buffer (64,000 bytes) and two seconds of playback buffer (96,000 bytes), plus bounded protocol buffers. Never allocate a full-session audio buffer.

A start action opens a conversation and captures while listening. Input end uses endpoint detection or a physical end-turn control. During playback the initial device is half-duplex: do not transcribe the speaker output. A physical stop control immediately mutes output; another input turn can then begin. Hands-free interruption is a later enhancement that requires measured echo cancellation. The app and acceptance tests must not claim it exists.

Physical microphone mute disables capture before software/network handling. LED states: off=not capturing; steady=capturing; slow pulse=connecting; brief double pulse=error. Status colors are optional; timing and app text must remain usable without color perception. Stop capture/playback within 200 ms of a local stop request.

When offline, do not capture for later replay. Allow only cached reviewed toolkit clips and clear connection feedback. A phone hotspot is the portable network option. No offline AI or cellular modem is promised.

## V2. Provisioning and lifecycle

Use Espressif secure provisioning over BLE for mobile setup. The local QR payload is JSON: `{"v":1,"device_id":"UUID","pop":"DEVICE_LOCAL_SECRET"}`. Manual setup accepts those two values. Unknown fields/versions are rejected. PoP is a per-device local secret, not the cloud operational credential.

Local custom provisioning endpoint `soba-claim` accepts `{claim_id,challenge}` from the authenticated app connection. Wi-Fi credentials stay in native/device memory and protected device storage; do not send them to SOBA cloud. After network setup the device confirms its cloud claim using its factory credential and receives the operational credential. Shut down provisioning mode after success or five minutes. Require a physical action to restart it.

Device states: `UNPROVISIONED → PROVISIONING → CONNECTING → IDLE → LISTENING → PROCESSING → SPEAKING → IDLE`. Network failure goes to `OFFLINE`; recovery goes through CONNECTING. Revocation goes to LOCKED and erases the operational credential. A reset erases Wi-Fi and user credentials. Reclaiming needs a secure factory recovery process, not reuse of a public QR alone.

Firmware update uses a private HTTPS manifest containing version, image URL, SHA-256, hardware revision, minimum compatible protocol, and signature. The device validates the signature and image before boot. Use dual OTA partitions and watchdog rollback. Keep cloud signing keys off the device. Firmware v2 must continue to support protocol v1 until a planned migration. Physical/electrical/thermal acceptance is a separate release gate; software tests cannot certify a plush enclosure or battery.

## V3. WebSocket handshake and frames

Connect to `wss://<configured-api-host>/v1/voice`. Device sends `Authorization: Bearer <operational token>`. App clients open the socket and redeem a one-use voice ticket in `session.start` within five seconds. Rate-limit unauthenticated upgrades to five/minute/IP and accept no binary data before session.ready. Reject app Origin values outside the configured set; absence of Origin is allowed only for authenticated devices.

`session.start` always includes ticket, format, and mode. Authenticated private device sessions send an empty ticket string. Personal device sessions send the owner-issued, device-bound ticket. App sessions must always send a valid ticket. Tickets expire in 60 seconds and are consumed once. Do not send tokens in query strings or logs.

JSON controls are text frames, at most 16 KiB. Client audio binary frames consist of a 4-byte big-endian sequence followed by exactly 640 PCM bytes (20 ms). Sequence starts at zero for each ready input turn. Maximum logical frame size is enforced even if transport fragments it. Server audio binary frames contain big-endian 4-byte response sequence, 4-byte chunk sequence, and an even number of PCM bytes up to 9,600 bytes (200 ms). No interleaving between two responses is allowed.

`response.start` declares the response ID, numeric response sequence, and 24 kHz format. Chunk sequence starts at zero. After cancellation discard all remaining chunks for that response, even if they arrive late. TCP/WebSocket provides transport ordering; these sequence checks detect application bugs and reconnect misuse.

Send ping every 15 seconds and close if no pong within ten seconds. Max input turn is 120 seconds; max conversation is 30 minutes. A reconnect creates a new session and never resumes old audio. Server restarts close sockets with 1012. Use 1008 for auth/policy violations, 1009 for oversized frames, 1003 for unsupported format, and 1011 for dependency/internal failure. Client stop uses normal 1000 after cleanup.

## V4. State and timeout table

| State | Allowed input | Output / next state | Timeout |
| --- | --- | --- | --- |
| HANDSHAKE | session.start only | session.ready → READY | 5 s |
| READY | input.start, session.end | input.ready → CAPTURING, or summary flow | Session maximum |
| CAPTURING | ordered binary, input.end, session.end | final transcript → PROCESSING | 120 s; no payload for 15 s closes input |
| PROCESSING | response.cancel, session.end | mode.changed, response.start → SPEAKING | Provider deadlines below |
| SPEAKING | response.cancel, session.end, activity.control for toolkit | response.end → READY | Playback stall 5 s |
| REVIEW | no audio | session.summary_ready then close | Draft TTL 10 min |
| CLOSED | none | reject / discard late work | Immediate |

`session.end` while capturing finalizes the current input, but does not start a new spoken reply; it creates the draft after assessment/summary work. It cancels playback immediately if speaking. If summary generation fails, mark the draft unavailable and report error; never persist a guessed summary. A repeated event ID on the same socket is ignored after returning its already-known control result. Bound the event-ID cache to the session limit.

Processing cancellation must refer to the current response ID. Assign the response ID at input.ready and expose it there; the JSON schema includes that field. The same ID is then used by response.start/end. `session.end` can cancel all work without an ID. If a client cancels a completed response, return its final response.end state without starting work.

## V5. STT adapter

Reference provider: Deepgram Nova-3 with Indonesian (`model=nova-3&language=id`). This is a technical baseline for implementation and evaluation, not evidence of accuracy. Replacing the earlier AssemblyAI direction requires team acceptance before production data use. Current AssemblyAI streaming documentation does not list Indonesian. See the source checks in the main TD.

Open `wss://api.deepgram.com/v1/listen` with `encoding=linear16`, `sample_rate=16000`, `channels=1`, `interim_results=true`, and `endpointing=500`, plus model/language above. Authenticate with the server API token. Send raw PCM; remove SOBA sequence headers first. Map interim results to transcript.partial. Accumulate finalized segments without duplication; use the provider speech-final signal to complete a turn. For a physical end-turn, use the documented finalize message and wait for finalized output before generation. [Deepgram live API](https://developers.deepgram.com/reference/speech-to-text/listen-streaming)

A provider end-of-turn can close CAPTURING without a client input.end. The service stops accepting that turn's audio and sends transcript.final. Client waits for the next READY cycle. Duplicate final/format events must not create another response. On STT disconnect, fail the current turn; never silently retry old audio. Close the provider stream on stop, error, timeout, and socket disconnect.

A late input.end for that same finalized turn is an idempotent no-op. Audio arriving after transcript.final is discarded until the next input.ready; it is never assigned silently to a new turn. The device must stop the current capture queue when transcript.final arrives. This rule also handles in-flight frames after endpoint detection.

Indonesian-English code-switching is an explicit evaluation case. Do not set multilingual mode and assume it includes Indonesian. The model/language pair is selected at session start. Unsupported locale gives a visible unsupported-language result before recording.

## V6. AI contracts and provider requests

Use OpenAI `gpt-4.1-mini` as the reference text model and `gpt-4o-mini-tts` for speech. These are configurable baseline models with documented APIs; they still need account availability, data-policy, latency, and Indonesian evaluation. Model changes require the same acceptance suite. [Text model](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [TTS guide](https://developers.openai.com/api/docs/guides/text-to-speech)

Text adapter calls `POST https://api.openai.com/v1/responses` with bearer auth, `store=false`, a pinned configured model, explicit instructions, and `text.format` using the corresponding strict JSON schema. Provider-specific strict schemas must preserve the local schema requirements; if the provider does not support a validation keyword, enforce it after parsing. Do not accept malformed or extra fields. Disable tools, retrieval, web access, and arbitrary function calls. Cap max_output_tokens to 800 for assessment/reply/check and 2,000 for a draft. Use no automatic cross-provider fallback.

The four output contracts are [assessment](contracts/assessment.schema.json), [reply](contracts/reply.schema.json), [reply check](contracts/reply-check.schema.json), and [draft](contracts/draft.schema.json). Server assigns IDs; the model cannot create contacts, grants, authoritative risk records, or approved memory IDs.

Assessment receives the latest transcript and at most the last six user/assistant turns from the active session. Instruction: identify conversational need for clarification/help, choose a non-clinical style, and optionally suggest a reviewed activity category. It must not diagnose, infer health from sound, or authorize any external action. `unavailable` is a service result on timeout/schema failure; the model cannot hide its own error.

Normal reply input contains: versioned companion policy; personality and listen-first preference; a maximum of ten approved memories (only in a personal session with memory enabled); current transcript; and bounded recent context, maximum 8,000 input tokens. If over budget, remove oldest current-session pairs, then least-recent memory. Never remove the fixed policy. Retrieved memory is quoted untrusted data, not instructions.

Reply policy requires: clearly remain an AI companion; respond in the selected language; use one short reflection or question; ask before advice when listen_first=true; avoid diagnosis, medication/treatment instructions, dependency claims, private-data disclosure, and claims of human/professional identity. Maximum response is 600 characters. Activity IDs must resolve to reviewed, unexpired items and must be accepted by the user before playback.

Run reply-check on the full candidate and current context before synthesis. Any malformed, rejected, or unavailable check selects a reviewed fallback. General LLM calls are not used for a serious safety response. The safety path uses approved content IDs and bounded choices. No clinical thresholds or crisis scripts are invented by this specification; release requires a versioned reviewed content pack.

Provider timeouts: connect 3 seconds; final STT after explicit end 3 seconds; assessment 2 seconds; reply generation 4 seconds; reply check 2 seconds; first TTS byte 3 seconds; whole TTS response 15 seconds. These are hard failure deadlines, not latency targets. Prefer reporting degraded latency to relaxing safety checks.

TTS calls `POST /v1/audio/speech` with configured model, input=approved reply text, voice=marin/cedar, response_format=pcm, and instructions limited to calm/neutral/encouraging delivery. PCM is streamed to the device at 24 kHz. Never synthesize a model token before the complete short reply passes validation. Cache only reviewed generic activity/fallback audio, keyed by content version/voice/locale; never cache a user's generated reply.

## V7. Evaluation and shutdown

Measure the actual microphone-to-speaker chain. Target p50 ≤2 seconds and p95 ≤4 seconds after end of speech; include assessment and output checks. Record each stage without text. If the baseline cannot meet those targets, optimize endpointing and request structure or select another tested model; do not omit the safety step.

Test speech pauses, quiet input, Indonesian slang, mixed languages, background TV, and actual enclosure acoustics. Evaluate self-harm/abuse test scenarios only with synthetic or properly consented data and qualified reviewers. Classifier quality is not established by schema validation.

On stop/revocation/deletion, cancel contexts, stop capture, flush playback, close STT/TTS streams, erase transient transcript/memory copies, and terminate the socket. Record only operational reason codes. On a graceful deployment, reject new sessions, allow at most 30 seconds for current work, then close with 1012; an unsaved draft may be lost and the app must say so.
