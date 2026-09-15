# SOBA on Vercel with the Tencent API

Public frontend: https://soba1.vercel.app

The frontend and backend are from the same SOBA repository. PostgreSQL stays on Tencent. Vercel serves the frontend and forwards `/v1` and `/health` to the API before the SPA fallback. This keeps authentication cookies and CSRF requests on the frontend origin.

## Required access

- Vercel project `xavrirs/soba-connected` is now linked and deployed. The previous `soba-xi` project remains unchanged.
- A stable public HTTPS API origin. The VPS currently uses a temporary `trycloudflare.com` tunnel. Do not use that as a production dependency.
- Auth0 application access to register the callback below.

## Prepare the frontend

Set `SOBA_API_ORIGIN` to the stable HTTPS API origin, then run from the repository root:

```bash
node deploy/vercel/configure.mjs
```

The command updates `frontend/vercel.json`. It preserves the asset headers and SPA fallback, and refuses temporary Cloudflare hostnames. Check the resulting diff before deployment. In Vercel use the existing SOBA project, root directory `frontend`, and Node 24. No backend secrets belong in Vercel's frontend build environment.

## Configure Tencent and Auth0

Set this value in the VPS shared environment file:

```dotenv
PUBLIC_BASE_URL=https://soba1.vercel.app
```

Register this exact allowed callback in Auth0:

```text
https://soba1.vercel.app/v1/auth/callback
```

Use the production override with the existing resource override:

```bash
docker compose -f compose.yaml -f deploy/tencent/compose.override.yaml -f deploy/tencent/compose.production.yaml up -d --build api
```

The production override sets `APP_ENV=production`, derives the allowed origin and callback from `PUBLIC_BASE_URL`, and keeps the existing database volume. Back up the database and shared configuration before switching releases. Do not run `down -v`. Keep the previous release and configuration available for rollback.

## Release checks

Check the public `/health/ready` response is JSON, not the SPA HTML. Complete real Auth0 login, create and reload a mood entry, test guardian scope enforcement, and download an export. Check logout and expired sessions. Confirm API responses are not cached by the CDN.

Voice requires provider credentials and a reviewed content pack. Verify a real WebSocket upgrade through the deployed Vercel route before enabling it; HTTP rewrite success alone does not prove voice works. Alerts also require configured delivery credentials. Keep unavailable services disabled.

The current local tests use an isolated database and test identity provider. They do not certify this production deployment. No live configuration was changed during the September 12 deployment inspection.

## Current routing status

The deployed Vercel rewrites now use the existing temporary Cloudflare tunnel as an interim API origin. This fixes requests reaching the static SPA, but does not remove the stable-hostname requirement. The VPS origin and callback now use `https://soba1.vercel.app`; the callback is registered in Auth0. The prior VPS environment was backed up before the change.

Live verification: Google sign-in completed through the Vercel origin and returned to authenticated onboarding. Profile/processing consent was left for the user. Health returned 200 JSON, unauthenticated profile 401 JSON, and auth start 200 JSON, all with no-store caching. The database volume was not changed.
