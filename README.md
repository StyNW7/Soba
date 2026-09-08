# Soba

Soba is a voice companion with a Go backend, a future web/mobile client, and a
future physical device. It is not a medical device, therapist, or crisis
service. Read [Safety and privacy](docs/safety-and-privacy.md) before changing
voice, safety, or personal-data code.

The backend uses the Go 1.27.1 toolchain.

## Repository layout

- `backend/` — Go API, PostgreSQL migrations, speech and safety pipeline,
  support notifications, jobs, and offline admin tools.
- `frontend/` — client application. Its directory is independent of the
  backend build.
- `iot/` — firmware and host protocol tests. Hardware selection remains a
  release decision.
- `docs/` — architecture, provider contracts, operations, and safety rules.

## Implementation specification

The [complete implementation specification](docs/implementation/README.md)
links the technical design, Notion source evidence, frontend and backend
behavior, database rules, device protocol, operations, exact contracts, and
acceptance tests. Use it as the entry point before changing an implementation
or interface.

## Local backend

The supported local path uses Docker Compose and PostgreSQL 17.

```bash
cp .env.example .env
openssl rand -base64 32  # run three times for the required key values
# Put the three values in DATA_ENCRYPTION_KEY, CURSOR_HMAC_KEY, AUDIT_HMAC_KEY.
docker compose up --build
curl http://127.0.0.1:8080/health/live
```

The API applies the embedded migrations at startup. To run the migration binary
separately, start the database and use the operations profile:

```bash
docker compose --profile ops run --rm migrate
```

The local API starts with cloud voice and push alerts disabled. Enable those
paths only after adding provider credentials and an approved content pack. The
API fails closed when `VOICE_ENABLED=true` without Deepgram, OpenAI, and a
current reviewed pack.

For a direct Go run, start PostgreSQL first, export the same variables, then:

```bash
cd backend
go run ./cmd/api
```

The backend uses a private `private-data` volume for encrypted export objects.
It is a pilot storage adapter. A production object bucket must remain private,
encrypted, and subject to the same deletion and key-rotation process.

## Offline administration

Admin commands use only PostgreSQL. They do not call identity, speech, or push
providers.

```bash
cd backend
go run ./cmd/admin device-enroll \
  --device-id 00000000-0000-4000-8000-000000000001 \
  --secret-file ./device-bootstrap.secret
```

The bootstrap secret is written once with mode `0600`. It is never printed or
logged. Treat it as a factory credential. Reviewed content and support-resource
records use a strict JSON import. Every resource URL must use HTTPS and its host
must be supplied with `--allowed-host`.

```bash
go run ./cmd/admin import \
  --file ./reviewed-content.json \
  --allowed-host support.example.org
```

The import format is documented in
[Runtime operations](docs/implementation/Runtime-Operations.md). Do not add
clinical or crisis wording to source code. Only an approved reviewer-owned
content file can enable the voice fallback path.

## Validation

```bash
python3 scripts/check_docs.py
cd backend && gofmt -l . && go vet ./... && go test -race ./...
cd ../iot/host_tests && cmake -S . -B build && cmake --build build && ctest --test-dir build --output-on-failure
```

The CI workflow also runs the API contract regeneration check against the
OpenAPI source, a PostgreSQL 17 service, backend race tests, and firmware host
tests.

See [Architecture](docs/architecture.md), [Speech pipeline](docs/speech-pipeline.md),
[Hardware](docs/hardware.md), and [Runtime operations](docs/implementation/Runtime-Operations.md)
for current boundaries and release gates.
