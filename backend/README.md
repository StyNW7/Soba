# Backend

The Go service behind Soba. It owns the speech pipeline, conversation logic, safety checks,
persistence, and the API the web app reads from.

**Status: not scaffolded.** This directory holds documentation only. There is no `go.mod`
yet and nothing to run.

## Stack

| | |
| - | - |
| Language | Go |
| Database | PostgreSQL |
| Driver | `pgx` |
| Migrations | Plain `.sql` files, applied in order. No ORM. |

## Responsibilities

- **Speech pipeline** — accept audio, transcribe it via AssemblyAI, synthesise the reply
  back to audio. See [`../docs/speech-pipeline.md`](../docs/speech-pipeline.md).
- **Conversation** — assemble context, generate the reply, persist the turn.
- **Safety** — check the transcript before generation and the reply before synthesis. This
  is the backend's job specifically because it is the one place every path goes through.
  See [`../docs/safety-and-privacy.md`](../docs/safety-and-privacy.md).
- **Devices** — register and authenticate dolls.
- **API** — REST for the web app; the device transport is still an open question.

## Planned layout

```
backend/
├── cmd/
│   └── api/              # entrypoint
└── internal/
    ├── httpapi/          # handlers, routing, middleware
    ├── speech/           # AssemblyAI client, audio handling, TTS
    ├── conversation/     # context assembly, reply generation
    ├── safety/           # risk detection, crisis path, reply checks
    ├── store/            # pgx access + migrations/
    └── auth/             # user sessions and device credentials
```

Nothing is fixed until someone writes it, but this mirrors the structure already in use in
`ruteaman-app/server/` — same `cmd/` + `internal/` split, same plain-SQL migrations, no ORM.

## Notes for whoever starts this

- **AssemblyAI has no first-party Go SDK.** For batch transcription their REST API is
  ordinary HTTP and this is a non-issue. For realtime streaming you are hand-rolling a
  WebSocket client or standing up a small Python sidecar — that decision is documented,
  unmade, and should be made before realtime work starts, not during it. See
  [`../docs/speech-pipeline.md`](../docs/speech-pipeline.md).
- **Accept audio from ordinary clients**, not just the doll — a script or a browser tab must
  be able to drive the pipeline so nobody is blocked on hardware that does not exist yet.
- **Keys stay here.** The AssemblyAI key, the LLM key, and the TTS key live in this service
  and never reach the doll or the browser.
- **Safety checks are not middleware you can skip in development.** If they are easy to
  bypass locally, they will eventually be bypassed in production.

## Getting started

Not scaffolded yet. Whoever picks this up first: `go mod init`, lay out `cmd/api` with a
health endpoint, commit that as its own change, and update this README with real run
instructions.

Read [`../docs/architecture.md`](../docs/architecture.md) and
[`../docs/conventions.md`](../docs/conventions.md) first.

Configuration comes from the environment — see [`../.env.example`](../.env.example).
