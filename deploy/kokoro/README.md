# Self-hosted Puck

Private CPU speech service for SOBA. It uses Kokoro v1.0, voice `am_puck`, English, speed 0.95. It requires no speech API key. Only the SOBA backend may call it; do not publish port 8000.

## Models

Download these upstream assets into `/opt/soba/shared/kokoro`:

- https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx
- https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin

Verify SHA-256 before starting:

```text
beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a  kokoro-v1.0.onnx
bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d  voices-v1.0.bin
```

The [model](https://huggingface.co/hexgrad/Kokoro-82M) uses Apache-2.0; [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) uses MIT. Preserve upstream licenses when distributing models. Model binaries are not committed to this repository.

## Start

From the release root:

```sh
docker compose --project-name soba --env-file /opt/soba/shared/.env \
  -f compose.yaml -f deploy/tencent/compose.override.yaml -f deploy/kokoro/compose.yaml \
  up -d --build --no-deps kokoro
```

Wait for `soba-kokoro-1` to become healthy. The model is loaded and warmed before the health endpoint responds. Configure the API only after a live test:

```dotenv
TTS_PROVIDER=kokoro
TTS_MODEL=am_puck
KOKORO_TTS_URL=http://kokoro:8000/synthesize
```

Keep the existing AssemblyAI STT and Groq LLM settings. Recreate only the API to apply its environment. Include all three Compose files for subsequent deployment operations. Never use `--remove-orphans` with a partial service file.

## Contract and limits

`POST /synthesize` accepts JSON `{"text":"Hello"}` (at most 600 Unicode characters, 8192 body bytes). One synthesis runs at a time; concurrent requests return 503. No transcript or generated audio is written to disk or request logs.

A successful response has content type `application/x-soba-pcm-frames`. Each frame is a four-byte unsigned big-endian byte count followed by signed 16-bit little-endian, 24 kHz mono PCM. A zero count ends the response. Missing termination is a failure. The Go adapter validates each frame before forwarding it through the existing voice WebSocket.

Replies are split at sentence or word boundaries, at most 120 characters per section, to reduce first-audio delay. Maximum output is 90 seconds; the client timeout is 60 seconds. The service stops starting new sections after 55 seconds. An active section can finish after cancellation, but the next socket write stops further synthesis when the connection has closed.

Container limits: 1400 MiB memory, 1.9 CPUs, no published ports, read-only root and model mount, non-root user. This is a small pilot configuration, not a concurrent-user capacity guarantee. Keep `MAX_ACTIVE_SESSIONS=1`. The current frontend supports incremental playback and a browser-voice fallback on provider failure.

## Validation

```sh
python -m unittest discover -s deploy/kokoro
cd backend
go test -race ./internal/speech ./internal/platform ./internal/app
```

Python tests need the service image's NumPy dependency. `backend/cmd/provider-check -live` supports `TTS_PROVIDER=kokoro` and checks Groq plus a Puck-to-AssemblyAI transcription round trip using fixed test text.

The INT8 model was slower than FP32 on the tested Tencent VPS and is not used.
