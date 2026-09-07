# Backend implementation specification

Normative for TD 2.0. The [OpenAPI contract](contracts/openapi.yaml) defines every HTTP operation and DTO. The [migration](database/001_initial.sql) defines storage. This document defines behavior that a schema cannot express. The [main TD](../SOBA-Technical-Design.md) defines scope and release gates.

## B1. Structure and ownership

Use Go with `net/http`, `pgx/v5`, and SQL migrations. One binary starts the HTTP server and job loops. Keep business logic out of handlers. Handlers decode, authenticate, validate, call a service, and serialize a dedicated DTO. Store methods accept the authenticated owner ID explicitly; never derive authority from a body field.

```text
backend/
  cmd/api/main.go
  internal/httpapi/{routes,errors,middleware}.go
  internal/auth/{oidc,sessions,permissions}.go
  internal/devices/{claims,status}.go
  internal/conversation/{session,turn,draft}.go
  internal/speech/{deepgram,openai_tts,pcm}.go
  internal/safety/{assessment,policy,content}.go
  internal/wellbeing/{journal,mood,memory,content}.go
  internal/support/{links,grants,requests,notifications}.go
  internal/jobs/{notification,export,deletion,expiry}.go
  internal/store/{queries,transactions}.go
  internal/store/migrations/001_initial.sql
```

Use one cancellable context per request, session, and provider call. Set a maximum request body of 64 KiB for normal JSON routes. Reject duplicate JSON keys, unknown fields, trailing JSON values, invalid UUIDs, invalid UTF-8, non-finite numbers, and unsupported content types. Trim names but preserve journal text. Length limits count Unicode code points. Reject empty role lists and duplicate roles. Validate timezone against the runtime IANA timezone database.

## B2. HTTP rules

1. Return JSON with `Content-Type: application/json`. Return no body for `204`.
2. Set `Cache-Control: no-store` on all private responses. Set `Vary: Origin` for allowed CORS requests. Never use a wildcard credentialed origin.
3. Use `404` for missing or unowned objects. Use `403` for an authenticated, recognized relationship that lacks a scope. Do not return whether another user's object exists.
4. Require the body `version` for every versioned edit. Run `UPDATE ... WHERE id=$id AND owner_id=$owner AND version=$expected RETURNING ...`. The trigger increments it. If no row changed, distinguish absent/foreign (`404`) from stale owned record (`409 version_conflict`). A new safety plan accepts version 1 and returns version 1; later writes use the stored version.
5. All changing operations marked with `Idempotency-Key` require a UUID. The same actor, method, route, key, and canonical request must return the original result. A different request gives `409 idempotency_conflict`. Include method in the stored route string.
6. Canonical request hash covers parsed JSON, path parameters, and content-affecting query parameters. Hash with SHA-256. Idempotency records and successful database changes commit in one transaction. A unique-key collision waits at most two seconds, then returns `409 request_in_progress` with `Retry-After: 1`.
7. Encrypt stored response bodies, including claim credentials, with the configured data-encryption key and record its version. Expire after 24 hours. Re-check authentication, ownership, and deletion state before replay. Do not replay removed content after deletion. Failed validation and forbidden requests are not stored.
8. List limits default to 20, maximum 100. Cursor payload contains sort tuple, owner/recipient ID, filters hash, and expiry, signed with HMAC-SHA256. Reject tampered or mismatched cursors with `400`. Expiry: 24 hours. Use descending `(created_at,id)` except sessions `(started_at,id)`, moods `(occurred_at,id)`, and memories `(updated_at,id)`. Edits can move memory entries between pages; clients deduplicate by ID. A page returns `next_cursor: null` at the end.
9. Request IDs are server UUIDs. Error bodies always include `code`, safe `message`, `request_id`, and `fields` (empty if not applicable). Never include tokens, raw SQL, model text, or private data.
10. Rate limits: 120 normal requests/minute/user; 20 writes/minute/user; five claim attempts/minute/user/device; five invitation attempts/minute/user; 10 auth starts/minute/IP. Voice concurrency is one active session per user and device. Return `429` with whole-second `Retry-After`.

Example failure:

```json
{"code":"version_conflict","message":"This item changed. Reload it and try again.","request_id":"10000000-0000-4000-8000-000000000001","fields":[]}
```

## B3. Login and app sessions

Use OpenID Connect authorization code flow. Configure exactly one issuer and separate registered web/mobile redirect URIs. Fetch discovery and JWKS only from the configured issuer; do not accept arbitrary issuers from requests. Validate signature algorithm allowlist, issuer, audience, expiry, nonce, and authorization state. Require a verified identity; a role selection is not an authorization claim.

`POST /v1/auth/start` creates a five-minute server-side flow with random 32-byte state and nonce, a PKCE verifier, and a fixed return path. Store hashes for state/nonce and encrypt the verifier. Return the issuer authorization URL using S256 PKCE. For mobile, require an additional app-generated S256 challenge; reject a missing challenge.

The issuer redirects to `GET /v1/auth/callback`. Atomically consume state, exchange the code once, validate the ID token, then find/create the profile using `(issuer,identity_subject)`. Initialize preferences and a blank safety plan with the profile. A new profile is `pending`, never automatically eligible for voice.

For web, issue a random opaque session cookie: `Secure; HttpOnly; SameSite=Lax; Path=/`. Expiry is seven days, with 12-hour inactivity expiry enforced by the service. Add `last_used_at` to session tracking through service state or a migration before implementing inactivity enforcement; v2 migration includes the field. `GET /v1/auth/csrf` returns a session-bound random token whose hash is stored. Require matching token plus allowed Origin on cookie-authenticated writes. Bearer-authenticated native requests do not require CSRF.

For mobile, callback redirects only to the registered app link with a random one-time code, valid for 60 seconds. `mobile-exchange` validates that code and the app verifier. It returns a 15-minute opaque access token and 30-day refresh token. Store only token hashes on the server. Refresh rotates both in one transaction. Reuse of the previous refresh token revokes that session family. Parallel refresh attempts must be serialized by the client. Native token storage must use Keychain/Keystore.

Logout revokes the current session and removes its cookie. Account deletion revokes all sessions. For export/account deletion, require issuer reauthentication within five minutes, validated from the ID token `auth_time`; do not replace it with callback time. `prompt=login`/`max_age=0` must be used when requesting fresh authentication.

Profile edits cannot set `eligibility`. The service computes eligibility from age band and the published policy. This specification uses `minimum_age=18` and `minor_enrollment_enabled=false` for the initial technical pilot. Under-18 enrollment remains implemented as a blocked state, pending an approved minor policy. This limits pilot eligibility; it does not remove the young-person requirement from the target product.

## B4. Device claims and session authority

`createDeviceClaim` requires an eligible owner. Limit live pending claims to three per owner. Lock the device row. Reject an owned device. Generate a five-minute challenge. Encrypt the challenge so the owner can resume a pending setup screen. Device credential values are random 32-byte tokens, base64url encoded.

`confirmDeviceClaim` authenticates the factory credential before comparing the challenge. Lock device and claim rows, verify device identity, expiry, owner eligibility, and unconsumed state. Update owner and operational credential, consume the claim, and save the encrypted success response in the same transaction. A repeat with the same idempotency key can recover that credential. Revoke factory authority for new claims, but permit authenticated replay of that same consumed claim during the five-minute recovery window. After the window, explicit secure recovery is required; do not create another owner.

Do not store the physical local provisioning proof-of-possession secret in API request bodies. Cloud claiming proves device identity; local setup proves physical access. Both are required.

`unpairDevice` locks profile then device, ends active sessions, revokes credentials, clears owner, and changes state to `revoked`. It cannot make the old device ready for a new claim without a factory-reset/recovery step. The same order is used by deletion. This is necessary because the database does not allow a `paired` device with no owner.

Heartbeat authenticates the operational credential and derives owner from the device row. Never accept a user ID. Use server time for last-seen. Battery and applied revision are device-reported values; label stale data. Return preferences and current voice permission. The API derives `online` from last-seen within 90 seconds; the stored device state remains `paired`.

Personal voice sessions require a one-use ticket issued by the owner app, bound to that device, valid for 60 seconds. Private sessions require the device credential and the owner's active processing permission but load no cross-session memory. A device credential alone never unlocks personal-memory playback.

## B5. Conversation, draft, and save transactions

At session creation: lock the profile, verify eligibility, processing consent, deletion state and device ownership, then insert an active session. Partial unique indexes enforce the single-session limits. Store `history_generation` and effective preference version. Active transcript, raw buffers, draft, and safety assessment live in process memory only. Session metadata contains no transcript or mood.

A turn follows the voice specification. Provider finalization is deduplicated. A session mutex serializes final transcript handling, cancellation, summary creation, and save. Database changes also lock profile and session rows, so process locks are not the only consistency control.

After session end, make the draft available for ten minutes. `listReviewSessions` returns only owned sessions in `review` state with unexpired drafts; it is not a hidden history of no-save conversations. `getSessionDraft` returns `410 draft_expired` after expiry/restart. No content is reconstructed from telemetry.

Save algorithm:

```text
authenticate owner; acquire session mutex
lookup unexpired draft; require expected draft version
BEGIN; lock profile then session
require not deleting, same history_generation, current processing consent
require session state=review and draft not expired
reserve/check idempotency record
validate all selected candidate IDs belong to this draft; reject duplicates
if all choices false/empty: mark discarded and return empty IDs
otherwise insert journal only if selected
insert conversation mood only if selected, using the user-confirmed label
insert exactly selected memory candidates; memory_enabled does not control saving
mark saved; persist encrypted idempotent response; COMMIT
erase transcript and draft; release mutex
```

The draft version starts at 1. There is no draft-edit endpoint in v2: the save request may confirm/change mood; journal and memory can be edited after save. A second save with a different key returns `409 invalid_state`, preventing silent duplication. A retry of the original successful key is served before the expired-draft check, subject to current ownership and deletion state.

Before removing expired session metadata, set `session_id=NULL` in all child journal, mood, memory, and safety rows. Remove discarded/expired metadata at 24 hours; saved sessions at 30 days. Saved content survives independently. Delete all session metadata with history deletion.

Check-ins accept at most seven days in the past and five minutes in the future. Server time is authoritative for persistence. Journals can only be created through selected session saves; a generic journal POST does not exist. Manual memory creation is explicit approval. Reject whitespace-only memory and enforce the 500-character limit.

## B6. Mood calculation and privacy

Own trend dates use profile timezone, with inclusive `from` and exclusive `to`; range 1–366 days. Return daily buckets. A bucket contains counts for all six labels, including zero counts. Empty buckets are `insufficient_data` with an empty `counts` array. Unknown values remain unknown.

Guardian trend dates must be Monday boundaries, range at most 13 weeks. Return complete weekly buckets only. Require `mood_trend`. Buckets with fewer than three saved mood entries return empty counts and `insufficient_data`. Reject arbitrary sub-week filters to prevent repeated requests from revealing individual entries. Deletions affect the next read because v2 does not cache aggregates.

Wellbeing Pulse requires `wellbeing_pulse`, exactly two complete Monday-to-Monday weeks. `check_in_count` counts only `source=check_in` in the second week. Calculate a non-clinical trend from confirmed ordinal labels: very_low=1, low=2, neutral=3, good=4, very_good=5; exclude unknown. Require at least three known entries in each week. Difference in means ≥0.5 is `improving`, ≤−0.5 is `declining`, otherwise `stable`. Display the term as a self-reported mood trend, never a health assessment. Insufficient samples produce `insufficient_data`.

## B7. Contacts, relationships, and grants

Contacts can exist without an app account for user-controlled OS calls/messages. Their stored phone is owner-entered and must be labeled unverified. Automatic SOBA alerts require an active linked account and a registered notification installation; phone entry alone never authorizes a send.

Create a trusted or guardian invite for one contact. Code is a 32-byte random bearer invitation, expires after 24 hours, and is shared by the user through the OS share sheet. SOBA does not send an invitation automatically. Acceptance consumes the code and binds the authenticated recipient, creates `links.state=accepted`, and invalidates other pending invites for that contact. A recipient cannot accept their own invite.

The subject sees the accepting account's display identity and approves the link. Only then is it `active`. If the identity is wrong, revoke and create a new invitation. Link approval does not create data grants. Subject creates individual scopes with the current policy version. Only guardian links may receive pulse/trend/contact-list/plan/referral scopes; both kinds may receive safety alerts.

Revocation transaction locks profile, link, and grants in that order. Mark link/grants revoked, cancel unsent support requests/jobs, then commit. Do not delete grant evidence while a support request references it. Contact deletion cascades relationships and support records; cancel in-flight sends first under the same dispatch guard described below. A phone change does not change the linked account identity.

Guardian subject list returns only active guardian relationships. It lists effective scopes but does not imply that absent scopes were granted. `connection-status` requires at least one of contacts/plan/referral scopes; omit unauthorized data as empty lists/null and list `visible_scopes`. Contacts expose display name and relationship only. No phone numbers, private text, model assessment, or journal summary appears in guardian aggregates.

## B8. Support requests and FCM

`createSupportRequest` always returns `awaiting_permission`. Check contact ownership, active link, active `safety_alerts` grant, and at least one current installation. For `safety_prompt`, require the supplied event ID from this user's live session; do not accept an invented safety label. The event is first transient and is persisted only when the user elects a support request. Manual help uses `reason=user_request` and no safety event. Limit three new requests/hour/subject/recipient.

Set expiry to 15 minutes after creation. `confirmSupportRequest` displays/sends only the fixed payload described in the frontend spec. In one transaction, lock profile → link → grant → request; re-check each permission, expected version, expiry, and current installations. Set confirmed_at, state=queued, and insert one notification job per active recipient installation. Grant the recipient access only to the minimal alert and user-approved Reach Out fields. Do not put free text into the notification.

Worker polls once/second. Claim up to ten jobs using `FOR UPDATE SKIP LOCKED`, assign a 30-second lease token, and commit. External calls do not hold a database transaction. Update results only when the lease token still matches. Retry transient outcomes at 10, 30, and 120 seconds after the preceding attempt; maximum four sends total. Expiry always overrides retries.

Immediately before dispatch, acquire an in-process guard keyed by subject/link, reload current permission/request/installation, and register the send as in progress. Revocation acquires the same guard: it blocks new dispatch after its commit. An external request already submitted cannot be recalled. If scaling beyond one service process, replace this guard with a documented distributed dispatch fence before enabling replicas. Do not claim atomic revocation across an external provider.

FCM HTTP v1 is the reference adapter. Android and iOS use FCM registration tokens; iOS also requires the team's APNs configuration. Call `POST /v1/projects/{project}/messages:send` with a server OAuth token and a 5-second timeout. Notification title is `SOBA`; body is `You have a support request.` Data contains only `request_id` and a fixed app route. Use a 15-minute TTL capped by remaining request lifetime. Do not use public topics. [FCM send API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send)

FCM success means `provider_accepted`, not delivered. v2 deliberately has no `delivered` state because the adapter does not establish it. Multiple installations share one request ID; clients deduplicate. A crash after send can produce a duplicate. Acknowledgement requires an authenticated recipient call. Never infer acknowledgement from push delivery or screen opening. `acknowledged` is not a clinical resolution.

Permanent invalid-token errors revoke that installation. If all jobs fail, mark the request failed. Once any job is accepted, preserve provider_accepted while waiting. On acknowledgement cancel remaining jobs. On expiry mark expired unless already acknowledged/cancelled. No fallback SMS/email or emergency dispatch occurs automatically.

`getReachOut` is available only to the selected recipient of a confirmed, unexpired request with current permission. Return the subject's explicitly shared phone (possibly null) and a fixed editable supportive message template. Never return the trusted contact's phone by mistake. The phone value is configured by the subject in profile settings and previewed at confirmation.

## B9. Content, referrals, exports, deletion

Toolkit and Parent Coach are read-only reviewed libraries. Filter by locale, kind, `review_status=approved`, and unexpired review. Content administrators use an offline validated import command, not a public CRUD API. If the requested item expires, return 404 and remove it from new lists. An activity already running stops at a safe boundary if its content is revoked. Resource URLs must be HTTPS and pass an allowlist; the API never fetches a caller-supplied URL.

Referral creation checks an existing unexpired resource. Initial state is `considering`. User may move to `contacted`, `appointment_reported`, or `closed`; `closed` can reopen to `considering`. Every state is explicitly user-reported. No appointment integration, payment, diagnosis, or clinician portal is implied.

Export snapshots the owner records at job start in a repeatable-read transaction, writes an encrypted private JSON object, and becomes ready for 24 hours. Download is proxied through the authenticated API. Include profile, approved journals, moods, and memories; include no audio, transcripts, other people's data, credentials, or internal assessments. Check current deletion generation before marking ready and before download. History deletion cancels exports and removes their objects.

History deletion locks the profile, increments history_generation, cancels sessions/drafts, blocks history reads until the deletion job finishes, and creates a ledger entry. Worker deletes content, session metadata, support records, safety events, and export objects. It also removes content-bearing idempotency responses for the actor, so deleted journals or memory cannot remain in retry storage. A minimal deletion-job response may remain for status recovery. It preserves profile/preferences/devices/contacts/links unless account deletion was selected. New history writes are rejected while deletion runs. The job is complete only after all required provider deletion steps have finished.

Account deletion first sets deleting=true, revokes all sessions/device credentials and queued dispatch, and returns a one-time deletion receipt. Subsequent job status uses only that receipt. It reveals ID/kind/state/times, never profile data. The worker deletes owned records and the profile. It retains the minimal HMAC subject deletion ledger for 31 days and removes the status receipt after 30 days. If provider deletion is pending, state remains waiting_provider; no false completion.

The provider adapters in v2 do not deliberately create persistent STT audio files or stored response objects. `store=false` is required on model requests where supported. This does not prove absence of provider abuse-monitoring retention. Provider terms/data controls are a release gate, not a local delete operation.

## B10. Database and runtime invariants

- Database sessions and saved children have composite owner foreign keys. Owner IDs are never changed after creation.
- No raw audio, transcript, model prompt, or draft body is stored in the schema.
- Every query and command checks profile deletion state before returning private data.
- Processing-consent withdrawal immediately cancels capture/provider work and personal context. It also starts history deletion after the explicit privacy screen confirmation; do not claim withdrawal leaves previously saved data deleted unless the job completed.
- Memory deletion takes the profile/session guard, removes the row, and cancels any unsent response using it. A response already spoken cannot be retracted.
- Jobs carry leases. Expired leases are reclaimable. A stale worker cannot overwrite a newer attempt.
- SQL constraints do not replace permission checks. All direct guardian/private-object API tests are mandatory.
