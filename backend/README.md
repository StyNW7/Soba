# Soba backend

The backend is a Go modular monolith. It owns authentication, device claims,
voice sessions, safety checks, wellbeing records, permissioned support, push
dispatch, exports, deletion, and retention jobs.

Build and run the backend with Go 1.27.1.

## Run

Use the root [Compose setup](../README.md#local-backend) for a local PostgreSQL
17 database. The API command performs the versioned migration check before it
starts:

```bash
go run ./cmd/api
```

The separate migration command is useful in deployment pipelines:

```bash
go run ./cmd/migrate
```

The admin command is offline and database-only. It enrolls a factory device
with a unique hashed bootstrap secret, or imports reviewed content/resources:

```bash
go run ./cmd/admin device-enroll --device-id UUID --secret-file ./device.secret
go run ./cmd/admin import --file ./reviewed-content.json --allowed-host support.example.org
```

The secret file is created with mode `0600` and is never printed. The import
command accepts only approved records and requires an HTTPS host allowlist for
support resources. It does not create safety text.

## Package boundaries

`internal/app` is the composition root. It acquires the database/schema
single-instance advisory lock, marks pre-existing active sessions interrupted
and review metadata expired, validates reviewed voice content, creates provider
adapters, and verifies that all 87 contract operations have exactly one
handler.

`internal/httpapi` owns contract validation, authentication middleware,
transactions, idempotency replay, CORS, rate limits, and safe errors. Business
logic stays in the owning service packages. `internal/store` owns PostgreSQL
pool settings and embedded migrations. `internal/jobs` owns encrypted export
objects and bounded cleanup/deletion work.

Voice is disabled unless `VOICE_ENABLED=true`, Deepgram and OpenAI credentials
exist, and `CONTENT_PACK_PATH` points to an approved, unexpired reviewed pack.
Push alerts are disabled unless `ALERTS_ENABLED=true` and Google workload
identity or application credentials are available. Keep these flags false in a
local setup.

## Checks

```bash
gofmt -l .
go vet ./...
go test -race ./...
go build ./cmd/api ./cmd/admin ./cmd/migrate
```

Set `SOBA_TEST_DATABASE_URL` to an isolated PostgreSQL database to run the
database and integration tests. Never point it at a user-data database.

Read [Backend-Spec](../docs/implementation/Backend-Spec.md), [Voice-Device-Spec](../docs/implementation/Voice-Device-Spec.md),
and [Runtime-Operations](../docs/implementation/Runtime-Operations.md) before
changing an API or lifecycle rule.
