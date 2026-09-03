# Speech pipeline

Audio in, transcript out, reply audio back. This is the part of Soba that has to feel
instant, and it is the part with the most unresolved decisions.

## Speech to text: AssemblyAI

[AssemblyAI](https://www.assemblyai.com/docs) handles transcription. It offers two modes,
and we have not committed to one:

| | Streaming | Batch (async) |
| - | --------- | ------------- |
| How | Open a WebSocket, push audio frames, receive partial and final transcripts as the user speaks | Upload the whole utterance, poll or receive a webhook when the transcript is ready |
| Latency | Low — the reply can start forming while the user is still talking | Higher — nothing happens until the user stops |
| Complexity | Connection lifecycle, reconnects, backpressure | An upload and a callback |
| Good for | A doll that feels alive | Getting something working this week |

**Recommendation:** start with batch per utterance to get the loop closed end to end, then
move to streaming once the rest of the pipeline is stable. Do not let the transport choice
block the conversation logic.

### The Go trade-off, written down

The backend is Go, which was a deliberate choice. The cost of that choice, so nobody
rediscovers it mid-sprint:

**AssemblyAI does not publish a first-party Go SDK.** Their maintained SDKs are Python and
JavaScript. In Go you have three options:

1. **Call the REST API directly** — straightforward for batch transcription. Upload, poll,
   done. This is a small amount of ordinary HTTP code.
2. **Hand-roll the streaming WebSocket client** — for realtime. More work: you own the
   framing, keepalives, reconnect logic, and partial-transcript handling.
3. **Run a small Python sidecar** for the streaming session only, and talk to it over a
   local socket. Keeps the mature SDK, adds a process to deploy.

Option 1 for batch is easy and uncontroversial. The decision between 2 and 3 only matters
once we commit to streaming. **Decide before starting realtime work, not during it.**

### Audio format

AssemblyAI's streaming API expects raw mono PCM. Assume until proven otherwise:

- 16 kHz sample rate
- 16-bit signed little-endian
- single channel

The doll should capture in this format directly rather than resampling on the backend —
resampling costs latency and quality for no benefit. **Confirm against the current
AssemblyAI documentation before the firmware locks its capture settings.**

### The API key

Lives in the backend, in `ASSEMBLYAI_API_KEY`. It never reaches the doll and never reaches
the browser. A doll is a physical object that can be taken apart; treat anything flashed to
it as public.

## Reply generation

The transcript plus recent conversation context goes to an LLM, which produces the reply
Soba speaks. Provider is an open question (see
[`architecture.md`](architecture.md#open-questions)).

Two things are not optional regardless of provider:

- **A safety check on the transcript before generation** — if someone is describing a
  crisis, the response path is different and does not run through a general chat model.
- **A safety check on the reply before it is spoken** — Soba speaks out loud, in someone's
  room, possibly to a child. See [`safety-and-privacy.md`](safety-and-privacy.md).

## Text to speech

Turns the reply into audio the doll plays. Provider undecided. The choice interacts with
hardware: cloud TTS means the doll only needs to play a stream, on-device TTS means the
board needs the headroom to synthesise. See [`hardware.md`](hardware.md).

Whatever we pick, the voice is part of the product. A companion doll that sounds like a
call-centre IVR is a worse product than one that sounds warm, independent of how good the
words are.

## Latency budget

For the doll to feel like it is listening rather than processing, aim for **under ~1.5
seconds** from the user finishing a sentence to Soba starting to speak. Rough split to
design against:

| Stage | Budget |
| ----- | ------ |
| Capture + endpointing on device | 200 ms |
| Upload / stream to backend | 100 ms |
| Transcription | 300 ms (streaming) |
| Reply generation | 600 ms (first token, if streamed to TTS) |
| TTS first audio | 300 ms |

These are targets to design against, not measurements. Replace them with real numbers once
the loop runs end to end.
