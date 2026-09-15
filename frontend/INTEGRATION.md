# Frontend and backend integration

The private frontend routes call the Go API. The API owns PostgreSQL access, authorization, encryption, consent, and retention. No database credentials or provider secrets belong in the frontend.

## Local setup

Use Node 24 for the frontend tests. Install dependencies with `npm ci`.

1. Configure the root backend `.env` from `.env.example`. Set the required encryption keys and OIDC credentials privately.
2. Start PostgreSQL with `docker compose up -d postgres`, apply migrations with `docker compose --profile ops run --rm migrate`, then start the API with `docker compose up -d api`.
3. In `frontend`, copy `.env.example` to `.env.local` if you need a different API target. Run `npm run dev`.
4. Open **http://localhost:5174**.

Use these backend values for local browser authentication:

```dotenv
PUBLIC_BASE_URL=http://localhost:5174
ALLOWED_WEB_ORIGINS=http://localhost:5174
OIDC_REDIRECT_URI=http://localhost:5174/v1/auth/callback
```

Register the same callback in the identity provider. Use `localhost` consistently. Sessions use Secure, HttpOnly cookies; do not disable these flags to work around an origin mismatch.

Vite forwards `/v1` and `/health` to `SOBA_API_TARGET` (default `http://127.0.0.1:8080`). It also forwards voice WebSockets. The browser never connects to PostgreSQL. The database port is bound to loopback.

## Production routing

Use one public HTTPS origin for the frontend and API routes. Route `/v1` (including WebSocket upgrades) and `/health` to the API before serving the SPA fallback. Set the public URL, allowed origin, and OIDC callback to that origin. `SOBA_API_TARGET` configures the Vite development/preview server only; it is not a production hosting configuration.

The existing Vercel file deploys static assets only. A production API proxy and voice-capable WebSocket route must be configured separately. Never put backend secrets in `VITE_*` variables.

## Connected features

| Area | Server-backed behavior |
| --- | --- |
| Authentication | OIDC redirect, cookie session, profile, onboarding, logout |
| Wellbeing | Mood entries, trends, journal, content library |
| Personalization | Preferences and permission-controlled memories |
| Circle | Trusted contacts, guardian invitations, approval and scope grants |
| Guardian | Authorized pulse, trends, alerts, support requests |
| Privacy | Policy consent, export and deletion jobs, recent-login handling |
| Devices | Claims, status, revocation; physical provisioning remains a separate step |
| Voice | Session ticket, PCM WebSocket transport, server draft review |

Writes use CSRF protection and idempotency keys. Errors remain visible; a failed request does not create a local success record. Private data is not persisted in localStorage. Old demo state is cleared. Unsupported services show their actual unavailable state.

## Checks

```bash
npm run build
npm test
npm run lint
npm run api:check
```

The API type generator requires Python with PyYAML. Run `npm run api:types` after an OpenAPI change; do not format the generated `src/api/schema.ts` manually.

Local validation used an isolated PostgreSQL database and the explicit test identity provider in `tests/oidc-provider.mjs`. Start that provider only with `SOBA_TEST_OIDC=true node tests/oidc-provider.mjs`. It binds to loopback port 9099 and is not a production login service. When using this fixture, run the Go API on the host so it can reach the loopback issuer. Keep test keys and database settings in an ignored local environment file.

Verified flows include login and onboarding, saved mood and preferences after reload, memory creation, guardian invitation/approval/grant/revocation, export download, and failed-write handling. Backend race tests, frontend unit tests, and the production build passed. Lint retains warnings in existing component patterns; the build also warns about the Three.js chunk size.

## Limits

This is local integration, not a VPS deployment. Real Google/Auth0 login, provider-backed voice, push delivery, and physical IoT hardware still require live verification. Voice and alerts were disabled in the local test environment. Transport tests do not prove microphone or provider quality.

The existing backend export file uses fields such as `format_version` and `mood_entries`, which differ from the documented ExportData field names. The frontend downloads the server file without parsing those fields. Consumers that parse exports must resolve this contract difference first.

## Dashboard presentation

The user overview now reuses the original repository layout with API-backed cards, quick actions, reflection preview, device status, and preferences. Shared pages use the original PageHeader, Card, and EmptyState components. Journal entries use searchable cards and an edit dialog; personality and voice use selectable cards. The voice orb reflects actual connection state. Guardian cards and charts remain scope-gated.

The original numeric wellbeing scores and fixed statistics are not restored. Charts show actual mood-label counts; unavailable and insufficient data remain explicit. Check-in labels match the backend contract. Local browser validation confirmed a check-in persisted after reload. No mock context is mounted.
