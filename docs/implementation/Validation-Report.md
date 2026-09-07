# Specification validation report

Date: 7 September 2026. Scope: SOBA TD 2.0 artifacts. No application implementation or live provider evaluation was performed.

## Executed checks

| Check | Result |
| --- | --- |
| OpenAPI 3.1 validation | Passed: 65 paths, 87 unique operations, 83 named schemas |
| JSON Schema validation | Passed: voice events and four AI output contracts |
| Request/response/event examples | Passed: 20 positive and negative cases |
| Requirement traceability | Passed: all 7 companion, 9 user, and 6 guardian features have acceptance rows |
| Local Markdown links and code fences | Passed; all target files present and fences balanced |
| Guardian DTO boundary checks | Passed: explicit closed schemas and no private-content fields |
| PostgreSQL migration | Passed on isolated PostgreSQL 17-alpine: 27 tables and version triggers created |
| Database invariant fixtures | Passed: 10 checks, fixture transaction rolled back |
| Source image files | Present; original images retained from the previous source capture |

The database checks cover duplicate active sessions, cross-owner saved journal, paired-device ownership, battery bounds, mood enum, duplicate live grant, required support confirmation, version/stale-write behavior, transactional rollback, and absence of transcript/audio/prompt/draft columns.

The database ran in a task-specific disposable container with no host ports, no network access, and temporary storage. No existing database or application container was modified. The temporary container was removed after testing.

## Reproduce contract checks

From the implementation directory:

```bash
python3 -m venv .spec-venv
.spec-venv/bin/pip install -r validation/requirements.txt
.spec-venv/bin/python validation/validate_spec.py
```

For the SQL checks, use a new empty PostgreSQL database dedicated to this test. Apply `database/001_initial.sql`, then execute `database/002_invariant_tests.sql` with `psql -v ON_ERROR_STOP=1`. Never run the fixture script against production. The initial migration is applied once by a migration runner; raw reapplication is not idempotent.

## Manual consistency review

Checked scope against the saved full Notion reading; compared request fields to screen actions; checked API/storage mappings; reviewed profile/relationship permission boundaries; checked save/delete/retry ordering; separated FCM acceptance from acknowledgement; and made provider, age-policy, and hardware release gates explicit.

Corrections made during review: added deletion receipt status after account logout; added explicit shared-phone field; added a response ID before processing so cancellation is possible; constrained support request contact/link and grant/link combinations; specified late audio handling; removed private retry responses during deletion; and made claim challenge null after confirmation/expiry.

## Not established by these checks

- No proof of clinical classifier accuracy or approved crisis scripts.
- No real Indonesian speech, mixed-language, acoustic, or latency benchmark.
- No implemented API authorization or mobile UI test run.
- No real provider notification, identity login, or vendor deletion test.
- No iOS/Android build, device pairing, battery, thermal, or OTA hardware validation.
- No production provider terms, deployment-region, or minor-policy approval.

These remain explicit implementation/release tests in Acceptance-Tests.md and Operations-Spec.md. A valid contract is not evidence that an application already implements it.
