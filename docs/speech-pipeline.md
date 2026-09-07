# Speech pipeline

The backend owns the audio path. The device or a browser test sends raw PCM to
the `/v1/voice` WebSocket. Provider keys stay in the backend.

## Current provider contract

| Stage | Adapter | Contract |
| --- | --- | --- |
| Speech to text | Deepgram Nova-3 | WebSocket, Indonesian `id`, 16 kHz, 16-bit signed little-endian mono PCM |
| Assessment and reply | OpenAI Responses | `store=false`, strict JSON Schema output, no tools, bounded timeouts |
| Text to speech | OpenAI `gpt-4o-mini-tts` | Approved text only, raw 24 kHz signed PCM output |

The model names are configuration. Pin and review provider versions before a
real-user release. Provider terms, region, retention, and training settings are
release gates.

## Per-turn flow

1. The client sends a short-lived voice ticket or a device bearer credential.
2. The server checks owner, device, consent, policy version, deletion state,
   locale, and the single active-session rule.
3. The client starts an input turn and sends 644-byte input frames: a 4-byte
   big-endian sequence followed by 640 bytes of PCM. Gaps, oversized buffers,
   and invalid audio fail the turn.
4. Deepgram interim text is sent to the client for display. A finalized
   transcript is used once; duplicate provider finals do not create duplicate
   replies.
5. The safety pipeline assesses the transcript. Serious or uncertain signals
   select reviewed fallback text. Only a normal, approved route calls reply
   generation.
6. The full candidate reply passes a second strict check. Unapproved text never
   reaches TTS. TTS output is sent as 24 kHz mono PCM frames with a response
   sequence, so the client can discard late audio after cancel.
7. On session end, the server creates a short-lived review draft only when a
   structured draft was produced. It does not store raw audio or transcript
   text.

## Fallback and outage rules

The safety package has no built-in clinical or crisis script. `app.New` loads a
reviewed JSON content pack with `Version`, `Locale`, `Approved`,
`ReviewExpires`, `GeneralText`, `SeriousText`, and reviewed activities. It
rejects missing, expired, duplicate, or mismatched content before enabling
voice. An outage can therefore produce a bounded reviewed response or a clear
degraded error, but it cannot produce guessed clinical wording.

Set `VOICE_ENABLED=false` to stop new cloud sessions while keeping account and
static support tools available. Existing sessions are cancelled during app
shutdown. No provider call is retried with old audio or old prompt data.

## Testing without a provider or device

The adapters accept injectable HTTP/WebSocket clients for tests. The Go suite
covers malformed provider responses, cancellation, strict output schemas,
duplicate finals, approval gates, and PCM bounds. The firmware host tests cover
frame sequence and response handling. Use synthetic fixtures only; do not copy
real conversations into tests.

Latency values in the operations specification are starting budgets. Measure
Indonesian speech, endpointing, first audio, cancellation, and network-loss
behaviour with an approved evaluation set before raising session limits.
