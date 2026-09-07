# Acceptance tests and implementation checklist

These tests specify required behavior. Only the checks listed as executed in [Validation-Report.md](Validation-Report.md) have run. Application, clinical-quality, and hardware tests remain for implementation.

## Requirement traceability

| Test | Requirement | Given / When / Then | Owner |
| --- | --- | --- | --- |
| AT-C1 | C1 Real Time Voice | Given approved session, when user speaks, then one finalized turn produces one audible approved reply within measured latency targets | Backend/firmware |
| AT-C2 | C2 Adaptive Response | Given explicit excitement or distress context, when reply style changes, then content remains non-diagnostic and accepts user correction | Backend/QA |
| AT-C3 | C3 Personalization | Given listen-first enabled, when a new turn starts, then correct preference version is applied and advice requires an offer/acceptance | Backend/frontend |
| AT-C4 | C4 Memory | Given two candidates, when only one is saved, then only that record can enter future personal context; private mode retrieves neither | Backend/QA |
| AT-C5 | C5 Grounding | Given an approved accepted activity, when pause/stop is pressed, then playback obeys it locally; no generated unsafe activity text appears | Firmware/frontend |
| AT-C6 | C6 Detection | Given reviewed serious/ambiguous/outage fixtures, when assessed, then the correct bounded path is selected and unchecked generated speech is blocked | Backend/reviewer |
| AT-C7 | C7 Human Connection | Given a serious signal but no grant/confirmation, when processed, then no job is queued; after both exist exactly one request is queued | Backend/QA |
| AT-U1 | U1 My Soba | Given QR/manual setup, when local proof and cloud claim succeed, then exactly one owner is bound and live/stale status is accurate | Mobile/firmware |
| AT-U2 | U2 Dashboard | Given voluntary and selected conversation mood, when loaded, then source labels are correct and no-save sessions are absent | Frontend/backend |
| AT-U3 | U3 Journal | Given a transient summary, when journal alone is selected, then journal exists, mood/memory do not, and expiry discards the draft | Frontend/backend |
| AT-U4 | U4 Patterns | Given missing dates and unknown mood, when charts render, then gaps remain gaps and timezone boundaries match backend buckets | Frontend/backend |
| AT-U5 | U5 Toolkit | Given approved/expired resources, when browsed, then only approved unexpired localized resources appear and stop is available | Frontend |
| AT-U6 | U6 Circle | Given an accepted invitation, when subject has not approved, then no access exists; after revoke all scopes cease | Backend/frontend |
| AT-U7 | U7 Professional | Given a verified directory record, when access is opened, then it opens the supplied destination; no booking is claimed and referral is user-reported | Frontend |
| AT-U8 | U8 Settings | Given an offline device, when preferences save, then server version changes and UI shows awaiting application until heartbeat reports it | Frontend/firmware |
| AT-U9 | U9 Privacy | Given stored/active content, when deletion or withdrawal starts, then reads/context are blocked, jobs show truth, and restore cannot resurrect it | All/operations |
| AT-G1 | G1 Pulse | Given permitted complete weeks with enough samples, when pulse loads, then documented calculation and check-in count match | Backend |
| AT-G2 | G2 Trend | Given guardian attempts journal/memory endpoints or narrow date filters, then access/filter is denied and no private fields appear | Backend/QA |
| AT-G3 | G3 Alert | Given confirmed allowed request, when FCM accepts, then state is provider_accepted; duplicate sends do not create duplicate alerts | Backend/mobile |
| AT-G4 | G4 Reach Out | Given a current alert, when recipient opens contact action, then only the subject-approved phone/template is provided; call completion is never inferred | Frontend/backend |
| AT-G5 | G5 Parent Coach | Given coach screen, when it loads, then reviewed content is returned without querying the subject's private conversation | Frontend/backend |
| AT-G6 | G6 Connection Status | Given only plan scope, when status loads, then only plan is visible; contacts/referrals remain empty with explicit visible_scopes | Backend/frontend |

F1 is covered by P1/P2 onboarding tests and AT-U1/U6. F2/F3 by AT-C1–C7. F4 by AT-C4/U2/U3/U9. F5 by all user/guardian rows. F6 by AT-C7/U7/G3/G4.

## Mandatory adversarial and failure scenarios

| ID | Scenario | Required result |
| --- | --- | --- |
| X01 | Replace owned UUID with another user's ID in every private route | 404 or documented scoped 403; no foreign content |
| X02 | Replay successful save after response loss | Original IDs returned; one copy per selected record |
| X03 | Reuse idempotency key with changed JSON | 409; no second mutation |
| X04 | Kill service between database commit and HTTP response | Retry recovers committed result; no partial save |
| X05 | Delete history during draft save | Profile/session lock and generation permit only one order; no post-deletion old-content resurrection |
| X06 | Revoke scope while notification leased | New dispatch stops; already-submitted external call is not falsely claimed recalled |
| X07 | Crash after FCM accepts before database update | Safe duplicate possible; one app alert by request ID; no exactly-once claim |
| X08 | Provider final transcript arrives twice | One reply, no duplicate turn |
| X09 | Cancel then deliver late TTS chunks | Device discards old response sequence |
| X10 | Buffer overflow or audio sequence gap | Affected turn fails visibly, no partial-text fabrication |
| X11 | STT/safety/reply-check/TTS unavailable | Bounded fallback; no unchecked speech or automatic alert |
| X12 | Wrong PoP, expired claim, concurrent claims | No takeover; only one confirmed owner |
| X13 | One device credential requests another owner's session | Rejected before audio processing |
| X14 | Guardian page left open during revoke/account switch | Content hidden on authorization refresh; cache never crosses subject/account |
| X15 | Child/unknown age during unapproved pilot policy | Voice cannot start; blocked state is visible |
| X16 | Model output includes extra fields, tool commands, invented IDs | Schema validation rejects or allowlist check fails |
| X17 | Logged exception contains provider payload/token | Scrubber removes content; test log capture contains no secret/text |
| X18 | Restore 29-day-old backup after deletion | Ledger replay removes content before traffic/jobs resume |
| X19 | Expired/revoked reviewed activity/resource | Cannot start new playback/access as approved content |
| X20 | Reused mobile refresh token | Session family revoked; client must reauthenticate |
| X21 | Cookie write without valid CSRF/Origin | 403 and no mutation |
| X22 | Account deletion after paired device exists | Unpair/revoke first, no database check failure or orphan authority |
| X23 | No-save session ends during deployment | No hidden durable copy; expired/unavailable draft explained |
| X24 | Invalid push registration bound to another user | Cannot overwrite another active binding without explicit account re-registration rules |

## Build and release checks

Backend: `gofmt`, `go vet ./...`, `go test -race ./...`, and `go build ./cmd/api`. Integration tests use isolated PostgreSQL and fake STT/LLM/TTS/FCM servers. Frontend: typecheck, lint, unit/component tests, build, browser route tests, and real iOS/Android smoke tests. Firmware: compiler warnings, format checks, capture/playback harness, control latency, network loss, OTA rollback, and physical power/thermal review.

Do not weaken an acceptance row to match a failing implementation. Record a deliberate scope change with source/product approval. QA records version, hardware, network, locale, sample count, expected result, observed result, and artifact link for each run. Clinical performance thresholds must come from the designated qualified reviewer, not an invented numerical pass rate.

## Handoff order

1. Generate API types from OpenAPI and commit the contract with the implementation.
2. Install migration through the versioned migration runner.
3. Build fake adapters and use the JSON examples before connecting providers.
4. Implement ownership and consent checks before exposing saved-data endpoints.
5. Build each UI against the exact operations and run its acceptance rows.
6. Complete real-device/provider tests and all operational release gates.
