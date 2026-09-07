# Runtime operations

This document is the runbook for the first Soba backend pilot. It complements
[Operations-Spec](Operations-Spec.md) with commands and current implementation
limits.

## Start and stop

The API is one Go 1.27.1 process. It runs embedded migrations, obtains a PostgreSQL
advisory lock scoped to `current_database()` and `current_schema()`, repairs
restart metadata, verifies the 87-handler registry, and then serves HTTP.
Starting a second API against the same database and schema fails safely.

```bash
docker compose up --build
curl http://127.0.0.1:8080/health/live
curl http://127.0.0.1:8080/health/ready
```

The API runs as the non-root `nonroot` user in the container. The root
filesystem is read-only. `/tmp` is a bounded memory filesystem and
`/app/private-data` is a private named volume.

Stop with SIGTERM. `cmd/api` first stops workers, tells active voice peers to
reconnect with service-restart semantics, clears transient tickets/drafts, and
releases the singleton lease. It then shuts down the HTTP listener. Unsaved
voice content is not recovered.

## Configuration

Copy `.env.example` to `.env`. Generate three separate 32-byte base64 values
for `DATA_ENCRYPTION_KEY`, `CURSOR_HMAC_KEY`, and `AUDIT_HMAC_KEY`. Keep all
provider and identity secrets in the deployment secret store. Required
production settings include HTTPS `PUBLIC_BASE_URL`, explicit HTTPS origins,
OIDC settings, current policy version, key version, and a database URL with
remote TLS.

`VOICE_ENABLED=false` and `ALERTS_ENABLED=false` are safe defaults. Voice can
be enabled only with Deepgram, OpenAI, and an approved unexpired content pack.
Alerts can be enabled only with FCM project configuration and Google workload
identity or application credentials. `MINOR_ENROLLMENT_ENABLED=true` is
rejected by the current pilot policy.

## Migrations

Run migrations with the embedded runner. It uses a checksum and advisory lock;
reapplying a matching version is a no-op and a checksum mismatch stops startup.

```bash
docker compose --profile ops run --rm migrate
cd backend && go run ./cmd/migrate
```

Do not run raw SQL migrations against an existing database. The initial schema
has 27 domain tables plus `schema_migrations`; the current binary includes
three migration files. Use additive changes, test them against the previous
schema, and keep rollback forward-only after user data exists.

## Offline admin

Enroll a physical device without calling a cloud provider:

```bash
cd backend
go run ./cmd/admin device-enroll --device-id 00000000-0000-4000-8000-000000000001 --secret-file ./device-bootstrap.secret
```

The command inserts only a SHA-256 bootstrap hash. It writes the unique secret
to a new `0600` file and never prints or logs its value. Copy the secret to the
secure factory provisioning process. Do not reuse it across devices.

Import approved toolkit content and support resources from a JSON file:

```bash
go run ./cmd/admin import --file ./reviewed-content.json --allowed-host support.example.org
```

Content records must carry an approved status, reviewer, locale, review time,
future expiry, and structured steps with `text`, `duration_seconds` (0–600),
and `audio_url` (null or an allowed HTTPS URL). Voice activities speak the reviewed
text. Resource records must use HTTPS and a host
listed by `--allowed-host`. The importer rejects unknown fields, duplicate IDs,
expired reviews, invalid phones, non-HTTPS URLs, credentials in URLs, and
unlisted hosts. It does not invent fallback or clinical content.

## Jobs, retention, and deletion

The data worker leases one export or deletion task at a time for 60 seconds.
Each run has a 55-second deadline. Deletion uses 500-row statements in one
transaction and checks cancellation between statements. Export checks the
history generation before and after its snapshot; it allows at most 50,000
rows per collection and 32 MiB of JSON. A failed job needs operator review and
a new request or controlled retry. The support
worker leases notification jobs with a four-attempt cap. Retention removes
expired encrypted exports and content-free operational metadata.

Export jobs record their object key before writing the file. Deletion also
checks the export job ID when no key was recorded. Hourly reconciliation
removes unreferenced files and abandoned temporary files after a one-hour
grace period. Database errors stop reconciliation; it does not guess which
files are safe to remove.

The `FilesystemObjects` adapter stores encrypted export bytes under a private
volume. It validates UUID object names, uses `0600` files, writes through a
temporary file, and never serves the directory directly. This adapter is for
the first pilot. It does not provide remote bucket versioning, cross-region
durability, or provider-side deletion. A production bucket must provide those
properties and must be private.

Key rotation is a release operation that is not automated in this pilot.
The process accepts one encryption key at a time. Stop writes, re-encrypt all
encrypted objects and database values with an audited offline tool, verify
reads, then change `DATA_KEY_VERSION` and restart. Do not replace the key while
old ciphertext remains. A rolling deployment with multiple key versions needs
a key-ring adapter before production use.

When `PROVIDER_DELETION_REQUIRED=true`, local account/history deletion ends in
`waiting_provider` after local data removal. An operator must use the reviewed
provider-specific deletion process, record its evidence in the deployment
system, and then complete the job. The backend does not claim provider
completion by itself.

## Observability and incidents

Logs contain request ID, route template, status, duration, and safe error code.
Metrics should cover active sessions, provider latency/errors, safety
unavailability, job age, notification outcomes, deletion age, pool saturation,
and process memory. Never add transcript, prompt, reply, journal, memory,
phone, push token, cookie, or provider-body labels.

If speech fails, set `VOICE_ENABLED=false` and keep account and static support
tools available. If push alerts are wrong, set `ALERTS_ENABLED=false`, cancel
unsent jobs, and retain only minimal event evidence. Revoke and rotate leaked
credentials. Do not impersonate a user to investigate.

## Backup and restore

Back up PostgreSQL and the private object volume with encryption and restricted
access. The pilot targets an RPO of 15 minutes and an RTO of four hours; verify
these targets with a restore drill. Restore into an isolated environment,
replay the deletion ledger, remove expired jobs and credentials, verify that
deleted content does not return, then enable reads, writes, and notifications
in that order.
