# Deployment, data operations, and release specification

## O1. Environments and deployment units

Build one Go image, one frontend static bundle, and signed firmware images. Deploy the Go API/job loop as one replica for the first pilot. Use PostgreSQL 17+, private object storage, and HTTPS termination with WebSocket support. The exact cloud vendor is configuration, not a second architecture. Use separate database, identity clients, storage, FCM project, and provider keys for development, staging, and production.

Development uses synthetic fixtures, mocked providers, and a local database. Staging may use real providers only with approved evaluation recordings. Production accepts users only after all release gates below pass. Do not copy real user conversations into test fixtures.

The API image uses a non-root user, read-only root filesystem, bounded temporary memory, no debug endpoints, and an explicit shutdown timeout. Limit the initial deployment to 10 simultaneous voice sessions, 2 GiB application memory, and 2 vCPU as a load-test starting point. These are sizing hypotheses, not a capacity guarantee. Measure peak buffers, sockets, and provider concurrency before raising the limit.

Use a database pool of maximum 20 connections, five idle, 30-minute lifetime. SQL statement timeout is five seconds for API requests; export/deletion jobs use bounded batches and separate 30-second statements. No API transaction remains open during provider calls. Set proxy WebSocket idle timeout above the application heartbeat interval.

## O2. Configuration contract

All secrets come from the deployment secret store or local environment, never from frontend variables. Validate configuration at startup. Fail closed when production settings or reviewed content are missing.

| Name | Required / default | Purpose |
| --- | --- | --- |
| `APP_ENV` | Required: development/staging/production | Controls fixture access and fail-closed checks |
| `HTTP_ADDR` | `:8080` | Internal listener |
| `PUBLIC_BASE_URL` | Required HTTPS outside local development | Fixed callback and app URL origin |
| `ALLOWED_WEB_ORIGINS` | Required explicit list | CORS and WebSocket Origin checks |
| `DATABASE_URL` | Secret, required | PostgreSQL connection; TLS required remotely |
| `OIDC_ISSUER` | Required HTTPS | Identity discovery and validation |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Required; secret for confidential client | Authorization code exchange |
| `OIDC_REDIRECT_URI` | Required fixed URI | Server callback |
| `MOBILE_RETURN_URI` | Required registered app link | One-use mobile login code return |
| `DATA_ENCRYPTION_KEY` | Secret, required, 32 bytes | AES-256-GCM for replay material, exports, push tokens |
| `DATA_KEY_VERSION` | Required | Encryption key rotation metadata |
| `CURSOR_HMAC_KEY`, `AUDIT_HMAC_KEY` | Separate required secrets | Signed cursors and pseudonymous audit/ledger IDs |
| `DEEPGRAM_API_KEY` | Secret, required for live voice | STT |
| `STT_MODEL`, `STT_LANGUAGE` | `nova-3`, `id` | Reference STT pair |
| `OPENAI_API_KEY` | Secret, required for live voice | Text and speech adapters |
| `TEXT_MODEL`, `TTS_MODEL` | `gpt-4.1-mini`, `gpt-4o-mini-tts` | Evaluated baseline, pin before release |
| `FCM_PROJECT_ID` | Required for alerts | Notification target project |
| `GOOGLE_APPLICATION_CREDENTIALS` | Secret path or workload identity | FCM authorization; prefer workload identity |
| `OBJECT_ENDPOINT`, `OBJECT_BUCKET` | Required for export/OTA | Private object storage |
| `OBJECT_ACCESS_KEY`, `OBJECT_SECRET_KEY` | Secrets if not using workload identity | Storage access |
| `POLICY_VERSION`, `CONTENT_PACK_PATH` | Required | Approved immutable policy/content pack |
| `VOICE_ENABLED` | false until configured | Stops new cloud conversations |
| `ALERTS_ENABLED` | false until reviewed and tested | Stops new external alert dispatch |
| `MINOR_ENROLLMENT_ENABLED` | false | Requires separate reviewed policy before change |
| `MAX_ACTIVE_SESSIONS` | 10 | Initial capacity guard |
| `SESSION_MAX_SECONDS`, `DRAFT_TTL_SECONDS` | 1800, 600 | Transient lifecycle |
| `RETENTION_AUDIT_DAYS`, `RETENTION_SUPPORT_DAYS` | 90, 30 | Content-free operational metadata |
| `BACKUP_RETENTION_DAYS` | 30 | Must match actual storage lifecycle |
| `EXPORT_TTL_SECONDS` | 86400 | Export object and download expiry |

Key rotation: encrypt new data with the new version, retain old decryption keys only while records use them, re-encrypt durable objects/installation tokens, then remove old keys after verification. Token hashes are SHA-256 of high-entropy random values; do not use this pattern for human passwords. Password handling belongs to the identity provider.

## O3. Migration and rollback

The [initial migration](database/001_initial.sql) is an executable PostgreSQL migration, not pseudocode. It creates the initial schema in one transaction. The migration runner uses an advisory lock and a schema_migrations table with version and SHA-256. Reapplying an already-recorded matching migration is a no-op; a checksum mismatch stops deployment. Do not rerun the raw SQL against an existing schema.

Before each production migration, validate it against the previous schema with realistic synthetic volume and a verified backup. Prefer additive changes: add nullable/new columns, deploy dual-compatible code, backfill in batches, then add constraints. Destructive removal requires a later release. A code rollback must use an image compatible with the current schema. Do not ship an automatic down migration that deletes user data.

For the initial schema only, rollback before any real data exists means discarding that isolated test database. After user data exists, restore or forward-fix under an explicit incident plan; do not drop all tables as a normal rollback.

## O4. Cleanup and workers

| Loop | Interval | Action |
| --- | --- | --- |
| Notification dispatch | 1 s | Lease up to ten ready jobs; four-attempt cap |
| Draft cleanup | 10 s | Erase expired in-memory drafts, update metadata |
| Session cleanup | 1 min | Mark orphan active sessions interrupted on startup; expire review metadata |
| Data jobs | 5 s | Lease one export/deletion task; bounded record batches of 500 |
| Auth/claim/invite cleanup | 15 min | Expire one-use state and encrypted replay material |
| Retention cleanup | 1 hour | Remove expired support/audit/ledger/export metadata and objects |

Use lease tokens and lease expiry on durable jobs. Data jobs use a 60-second lease renewed every 20 seconds. A worker checks cancellation/deletion generation between batches. One task failure must not stop the entire worker loop. Permanent failures need a visible error code and operator alert, with no sensitive payload in logs.

Delete support jobs/requests before safety events and grants. Detach saved children before pruning session metadata. During account deletion unpair devices before deleting the profile, cancel in-flight dispatch, and preserve the minimal deletion ledger. Verify object deletion after the storage call; a failed storage deletion leaves the job pending/failed, not complete.

## O5. Observability and incident response

Log structured fields: timestamp, level, request_id, route template, response code, duration, coarse failure code. Do not log query tokens, Authorization, cookies, QR/PoP, push token, phone, transcript, prompt, generated reply, journal, memory, or raw provider response. Scrub exception messages before export to monitoring.

Metrics: current sessions, input bytes, dropped frames, stage latency histograms, end-of-speech to first-audio histogram, provider errors/timeouts, unavailable safety checks, job backlog/oldest age, notification accepted/failed/acknowledged counts, deletion age, DB pool saturation, and process memory. Use aggregate labels; no profile IDs or safety content.

Initial operator alert thresholds: p95 voice latency >4 s for ten minutes; provider failure >5% over five minutes with ≥20 calls; oldest confirmed notification job >30 s; any history deletion older than 24 h; DB readiness failure >30 s; process memory >80% for ten minutes. Review after pilot measurements.

If voice dependency fails: stop new voice sessions through VOICE_ENABLED, keep static support tools and account controls available, and show degraded status. If incorrect alerts occur: stop new dispatch with ALERTS_ENABLED, cancel unsent jobs, retain minimal event evidence, and investigate without opening private conversations by default. If a credential leaks: revoke/rotate it, stop its affected path, and check access metadata. No operator silently impersonates users.

## O6. Backup and recovery

Target database recovery point ≤15 minutes and recovery time ≤4 hours for the pilot. Configure and test backup/WAL retention to achieve those targets; they are not properties of the migration itself. Encrypt backups, retain for 30 days, and restrict restore access. Test a restore in an isolated environment before launch and monthly during operation.

Restore sequence: block user traffic and jobs; restore DB/object state; replay the deletion ledger up to current time; remove expired credentials/drafts/jobs; verify no deleted content returns; run read-only integrity checks; enable API reads; then enable new writes and finally dispatch. Reconcile notification jobs against provider state where possible to reduce duplicate sends. Restoring a database must not replay expired safety alerts.

## O7. Release gates and ownership

| Gate | Accountable role | Required evidence |
| --- | --- | --- |
| Contracts and schema | Backend lead | OpenAPI/JSON Schema validation, migration execution, invariant tests |
| Mobile delivery | Frontend/mobile lead | Real iOS/Android login, permissions, pairing, push navigation |
| Firmware and device | Firmware/hardware lead | Capture/playback, mute, OTA rollback, enclosure/power tests |
| Speech performance | Backend + QA | Indonesian evaluation set, end-to-end latency, cancellation tests |
| Support policy/content | Product + qualified reviewer | Approved scripts, classifier thresholds, age rules, escalation boundaries |
| Provider/data policy | Product/privacy owner | Retention/training/region terms and approved processor disclosures |
| Recovery | Operations owner | Restore drill, deletion replay, alert cancellation/duplicate tests |
| Product scope | Product owner | All 22 Notion requirements accepted against Acceptance-Tests.md |

No named personnel or deadline is invented. Assign each role before implementation starts. Technical defaults in TD v2 allow coding; these release gates govern real-user operation.
