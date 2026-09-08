# SOBA implementation specification

This directory is the entry point for the complete SOBA implementation
specification. Start with the
[technical design](../SOBA-Technical-Design.md), then use the component document
that owns the behavior you are changing.

The specification covers the complete `LISTEN -> SUPPORT -> CONNECT` product
flow found in the source Notion page. It defines frontend, backend, database,
voice, device, privacy, operations, and acceptance behavior. The
[Notion source notes](../Notion-Source-Notes.md) record the inspected source
sections, feature rows, diagrams, and known source limits.

## Document map

| Document | Use it for |
| --- | --- |
| [Technical design](../SOBA-Technical-Design.md) | Product scope, architecture, ownership, decisions, delivery sequence, and release gates |
| [Backend specification](Backend-Spec.md) | OIDC, sessions, authorization, transactions, jobs, deletion, and data lifecycle |
| [Frontend specification](Frontend-Spec.md) | Routes, screens, forms, state handling, accessibility, and mobile bridges |
| [Database specification](Database-Spec.md) | Tables, relationships, constraints, indexes, queries, and deletion order |
| [Voice and device specification](Voice-Device-Spec.md) | Audio protocol, conversation state, provider adapters, firmware, pairing, controls, and OTA |
| [Operations specification](Operations-Spec.md) | Environments, secrets, deployment, monitoring, backup, recovery, retention, and release roles |
| [Acceptance tests](Acceptance-Tests.md) | Requirement coverage, failure cases, privacy checks, and delivery evidence |
| [OpenAPI contract](contracts/openapi.yaml) | Normative HTTP paths, fields, bounds, status codes, and authentication rules |
| [Voice event contract](contracts/voice-events.schema.json) | Normative WebSocket control and lifecycle messages |
| [Provider schemas](contracts/) | Assessment, reply, reply-check, and review-draft JSON boundaries |
| [Reference SQL](database/001_initial.sql) | Executable reference schema and storage invariants |
| [Runtime operations](Runtime-Operations.md) | Commands for the implemented API, migrations, administration, providers, and shutdown |
| [Validation report](Validation-Report.md) | Evidence from validation of the specification package |

## Authority and change rules

The OpenAPI, JSON Schema, SQL, and component specifications are normative. The
validation report records evidence and does not replace runtime testing. If two
documents disagree, resolve the conflict before implementation. Do not choose a
contract silently.

When a DTO, event, database rule, or user flow changes, update its normative
contract, fixtures, consumers, and acceptance tests in the same change. Keep
provider credentials and deployment secrets outside Git.

## Current implementation boundary

The repository contains the Go backend, PostgreSQL migrations, provider
adapters, reference ESP32-S3 firmware, operational tooling, and contract tests.
The frontend document is complete as an implementation contract, but frontend
code remains a separate delivery item. Physical hardware validation, approved
support content, public HTTPS, production identity credentials, live provider
tests, and the other gates in the operations specification are still required
before production release.

## Validation

Run the repository documentation checks from the repository root:

```bash
python3 scripts/check_docs.py
```

Run the specification validator in an isolated Python environment:

```bash
python3 -m venv /tmp/soba-spec-venv
/tmp/soba-spec-venv/bin/pip install -r docs/implementation/validation/requirements.txt
/tmp/soba-spec-venv/bin/python docs/implementation/validation/validate_spec.py
```

The SQL invariants require a disposable PostgreSQL database. Apply
`database/001_initial.sql`, then run `database/002_invariant_tests.sql`.
