# SOBA project handoff

Updated: 13 September 2026 (Asia/Jakarta).

## OpenRouter candidate update

The owner supplied an OpenRouter key and requested `google/gemma-4-31b-it:free` first, then `google/gemma-4-26b-a4b-it:free`. The adapter, configuration and failure tests are implemented locally. Both free models returned upstream HTTP 429 during live tests, so the VPS text model was not changed. The key is stored only in the ignored private local environment. See [the candidate setup and evidence](implementation/Voice-Provider-Setup.md#openrouter-gemma-4-candidate-not-deployed). Do not describe Gemma voice conversations as working until the live tests pass.

## September 13 artwork and provider-key update

The supplied brown bear sheet now has 19 cropped SVG views and appears across the public site, sign-in, dashboards, check-in choices, and empty states. The teammate's original design and the real API data flow are retained. See `frontend/src/components/ui/SobaBear.tsx`, `frontend/scripts/export-bears.mjs`, and the September 13 section of `frontend/DESIGN.md`. Standalone SVG crops and a contact sheet are in `/home/xavrir/Downloads/SOBA-Bear-Crops`.

AssemblyAI and Gemini are now wired into the backend and deployed to `/opt/soba/releases/voice-20260913-7412dc3c`. The private VPS environment selects AssemblyAI `universal-3-5-pro`, Gemini `gemini-2.5-flash-lite`, and Gemini `gemini-3.1-flash-tts-preview`. The complete live provider checker passed locally and on the VPS with a fixed synthetic English phrase. Policy `pilot-v2-assemblyai-gemini` lists the new providers. The frontend has a direct WSS origin configured for the API tunnel. No credentials are in frontend assets or Git.

Voice is enabled after the owner explicitly removed the independent-review prerequisite and authorized the prepared fallback responses. The local authenticated browser received synthetic speech and scheduled 9.32 seconds of Gemini playback. The subsequent review failed, and follow-up calls confirmed Gemini's daily free quota of 20 text requests for the selected model is exhausted. Replies and reviews remain quota-limited until reset or a higher account quota. AssemblyAI supports English only in this integration; unsupported profiles are rejected before capture. See [provider setup and deployment evidence](implementation/Voice-Provider-Setup.md) for activation, checks, quota evidence and rollback.

Validation: frontend build and all 17 frontend tests pass; lint reports existing warnings. The 19 exported crops were inspected together. Desktop and mobile dashboard, sign-in and journal checks passed. A check-in with the illustrated controls saved to the isolated local PostgreSQL database. No live user data was created for this check.

## 1. Current status

SOBA has a technical design, implementation specification, Go backend, PostgreSQL database, reference ESP32-S3 firmware, and a React frontend. The public frontend now calls the Tencent VPS API through Vercel rewrites. Real Google sign-in through Auth0 was tested and returned to authenticated onboarding. The session survived a reload.

**This is a working pilot, not a fully validated production release.** The API still depends on a temporary Cloudflare tunnel. Voice providers, push delivery, physical hardware, and disaster recovery still have release gates.

The latest frontend changes are deployed to Vercel from a local worktree, but are **not committed or pushed to GitHub**. Do not assume that cloning main reproduces the deployed frontend.

## 2. Locations and ownership

| Item | Location / value |
| --- | --- |
| GitHub repository | https://github.com/StyNW7/Soba |
| Active local worktree | `/home/xavrir/Soba-frontend-local` |
| Active branch | `design/frontend-local` |
| Base commit | `7b05da3` — `feat: push frontend upgraded version` |
| Other local checkout | `/home/xavrir/Soba` — older documentation checkout; not the active frontend workspace |
| Public website | https://soba1.vercel.app |
| Vercel account/team | `xavrir` / `xavrirs` |
| Vercel project name | `soba-connected` (internal name; the public address is `soba1.vercel.app`) |
| Latest deployed frontend at handoff | `dpl_FtSTbGnuR25G8ghAcUPzwrysg2En` |
| Deployment inspection | https://vercel.com/xavrirs/soba-connected/FtSTbGnuR25G8ghAcUPzwrysg2En |
| Tencent VPS | `150.109.23.187`, Singapore; TencentOS Server 4 |
| VPS capacity recorded in setup | 2 CPU cores, 4 GiB RAM, 1 Mbps public bandwidth |
| VPS active release | `/opt/soba/current` → `/opt/soba/releases/772f66b` |
| VPS private environment | `/opt/soba/shared/.env`, mode `0600` |
| Auth0 tenant | `dev-yfb5wccd8imvbnoh.us.auth0.com` |
| Auth0 application | `SOBA`, Regular Web Application |

The old `soba-xi.vercel.app` deployment belongs to a project the current Vercel account could not access. It was not changed. `soba.vercel.app` was already taken. `soba-connected.vercel.app` was the initial new address; use `soba1.vercel.app` for login because it is the configured origin.

## 3. Product and source context

SOBA means **Speak Openly, Breathe Again**. The product flow is **LISTEN → SUPPORT → CONNECT**: a private voice companion, user-controlled reflection and memory, and permission-limited human support. It must not present itself as a diagnosis or emergency service.

Original Notion source:
https://app.notion.com/p/raineryesaya/SOBA-3d40560e43d880efbf68caca2589736d

Start with these repository files:

- [Technical design](SOBA-Technical-Design.md)
- [Notion source notes](Notion-Source-Notes.md)
- [Implementation specification index](implementation/README.md)
- [Backend specification](implementation/Backend-Spec.md)
- [Database specification](implementation/Database-Spec.md)
- [Frontend specification](implementation/Frontend-Spec.md)
- [Voice and device specification](implementation/Voice-Device-Spec.md)
- [Operations specification](implementation/Operations-Spec.md)
- [Runtime operations](implementation/Runtime-Operations.md)
- [Acceptance tests](implementation/Acceptance-Tests.md)
- [OpenAPI contract](implementation/contracts/openapi.yaml)
- [Voice event contract](implementation/contracts/voice-events.schema.json)

Some earlier documents still describe the frontend as a separate delivery item. This handoff and the frontend integration notes describe the later work; the contracts remain the source for API behavior. Resolve contract differences explicitly.

## 4. Completed backend and database work

The Go modular monolith owns authentication, profiles, consent, wellbeing records, guardian permissions, device claims, voice sessions, safety processing, support requests, referrals, exports, deletion, and retention jobs.

Important code boundaries:

- `backend/internal/app`: service composition and startup checks.
- `backend/internal/httpapi`: route validation, cookies, CSRF, CORS, rate limits, idempotency, and errors.
- `backend/internal/store`: PostgreSQL access and embedded migrations.
- `backend/internal/auth`: identity and session handling.
- `backend/internal/conversation`, `speech`, `safety`: voice and processing lifecycle.
- `backend/internal/devices`, `support`, `wellbeing`, `push`, `jobs`: domain services.

PostgreSQL 17 runs on Tencent. The database port is loopback-only (`127.0.0.1:55432`). The API port is also loopback-only (`127.0.0.1:8080`). The frontend never connects directly to PostgreSQL.

The integration work used a separate local database and did not replace or erase the VPS database. Production data volume names must be checked before any operation. Never use `docker compose down -v` on the live stack.

Merged PRs, verified at handoff:

1. [Backend, database, and IoT pilot](https://github.com/StyNW7/Soba/pull/1)
2. [Tencent Cloud pilot deployment](https://github.com/StyNW7/Soba/pull/2)
3. [Complete implementation specification](https://github.com/StyNW7/Soba/pull/3)

## 5. Frontend work and final design decision

The frontend is the teammate's React/Vite/TypeScript code from this repository. It was not replaced with a separate generated website.

Design exploration included campaign images, a SOBA box/teddy concept, translucent teddy references, and local editorial/Three.js experiments. The user later rejected our visual redesign and requested the teammate's original design with real data.

Final direction:

- Original public landing layout, fonts, navigation, and styling restored from the repository.
- Our Three.js/parallax components and added font/Three.js dependencies removed from the active frontend.
- Original user overview structure reused: check-in panel, statistics, chart/reflection columns, quick actions, device and preference cards.
- Shared private pages use the teammate's `PageHeader`, `Card`, and `EmptyState` components.
- Journal uses searchable cards and an edit dialog.
- Personality and voice choices use selectable cards.
- Voice uses the original orb with real connection state.
- Guardian cards/charts show only authorized server data.

This is an adaptation of the original design to the API, not a byte-for-byte restoration of every old mock screen. Old fixed scores, fabricated statistics, demo history, simulated conversations, and unsupported actions were not restored. Charts show actual mood-label counts. Empty accounts have empty states.

### Important frontend files

| Path | Responsibility |
| --- | --- |
| `frontend/src/api/client.ts` | Same-origin requests, cookies, CSRF, idempotency, timeout, pagination, error handling |
| `frontend/src/api/schema.ts` | Generated OpenAPI types; do not manually format |
| `frontend/src/api/dates.ts` | Personal date ranges and complete guardian weeks |
| `frontend/src/api/voice.ts` | Ticket-based PCM WebSocket transport |
| `frontend/public/audio/capture.js` | AudioWorklet capture frames |
| `frontend/src/context/AuthContext.tsx` | Real session/profile state and OIDC login/logout |
| `frontend/src/pages/auth/` | Login and onboarding |
| `frontend/src/pages/user/Overview.tsx` | Original overview layout with live data |
| `frontend/src/pages/connected/` | API-backed private pages and shared state |
| `frontend/src/pages/connected/CheckIn.tsx` | Real check-in submission with failure state |
| `frontend/src/pages/connected/TrendChart.tsx` | Counts chart and accessible data table |
| `frontend/src/router/index.tsx` | Current route ownership |
| `frontend/vercel.json` | Public API rewrites before SPA fallback |
| `frontend/vite.config.ts` | Local API and WebSocket proxy |

`AppDataProvider` is not mounted. Older mock pages and data files remain in source but are not used by the active private routes. Do not remount the mock context to recover a visual component.

Read [frontend integration notes](../frontend/INTEGRATION.md) and [frontend design notes](../frontend/DESIGN.md).

## 6. Deployment and authentication

Current request flow:

```text
Browser: https://soba1.vercel.app
  ├─ static frontend → Vercel
  └─ /v1/* and /health/* → Vercel external rewrite
       → existing Cloudflare Quick Tunnel
       → Tencent API on 127.0.0.1:8080
       → PostgreSQL
```

Current temporary API origin:
`https://put-lift-car-carries.trycloudflare.com`

This is intentionally documented as an interim dependency. Its address can change after a tunnel restart. `cloudflared-quick.service` serves the current route; a separate `cloudflared.service` is also active. Inspect their roles before stopping either service.

VPS public settings were backed up and changed to:

```dotenv
PUBLIC_BASE_URL=https://soba1.vercel.app
ALLOWED_WEB_ORIGINS=https://soba1.vercel.app
OIDC_REDIRECT_URI=https://soba1.vercel.app/v1/auth/callback
```

The exact callback was added to the existing Auth0 SOBA application without removing its older entries. Google login uses the existing Auth0 social connection. The observed Google flow uses Auth0's shared Google callback; dedicated production Google credentials have not been established by this work.

A previous login error was caused by Vercel sending `/v1/auth/start` to the SPA. POST returned 405 and GET `/v1/me` returned HTML. Explicit API rewrites fixed this. Do not remove or put these rewrites after the catch-all SPA route.

Login sequence verified:

1. Frontend POSTs to `/v1/auth/start`.
2. API starts OIDC authorization with PKCE/state.
3. User signs in with Google through Auth0.
4. Auth0 returns to the Vercel callback route, forwarded to the API.
5. API establishes a Secure, HttpOnly session and redirects to `/app`.
6. A new account goes to `/onboarding`; profile and consent choices belong to the user.

The local production override at `deploy/tencent/compose.production.yaml` was prepared and structurally checked, but **was not applied to the current VPS release**. The live API restart used the existing Compose files. Do not assume `APP_ENV=production` is active just because Vercel calls this a production deployment.

## 7. Development and release commands

Use the active worktree and preserve its uncommitted files.

```bash
cd /home/xavrir/Soba-frontend-local/frontend
npm ci
npm run dev
```

Open `http://localhost:5174`. Vite proxies `/v1` and `/health` to `SOBA_API_TARGET`, default `http://127.0.0.1:8080`, including WebSocket traffic. Keep `localhost` consistent with the local OIDC callback.

Use Node 24 for tests. In this machine's shell, npm sometimes ran child commands under Node 20 despite a mise wrapper. These direct commands worked:

```bash
mise exec node@24.20.0 -- node --test tests/*.test.mjs
mise exec node@24.20.0 -- node node_modules/typescript/bin/tsc -b
mise exec node@24.20.0 -- node node_modules/vite/bin/vite.js build
python3 scripts/generate-api-types.py --check
```

The type generator requires PyYAML. Use `npm run api:types` after a contract change and check the result.

Backend checks, from `backend/`:

```bash
go vet ./...
go test -race ./...
```

Set `SOBA_TEST_DATABASE_URL` only to a disposable isolated database. Local test resources include `.env.integration` (ignored, private), container `soba-integration-postgres-1`, and the opt-in test IdP `frontend/tests/oidc-provider.mjs`. That IdP requires `SOBA_TEST_OIDC=true`, binds to loopback port 9099, and must never become the production identity provider.

Current frontend deployment command:

```bash
cd /home/xavrir/Soba-frontend-local/frontend
vercel deploy --prod --yes --scope xavrirs
```

The local `.vercel` directory links the existing project. No GitHub push is needed for this CLI command; that is why deployed code currently differs from GitHub. Do not create another project by mistake.

For a future stable API origin, `deploy/vercel/configure.mjs` updates the rewrites from `SOBA_API_ORIGIN`. It rejects temporary Cloudflare hosts. The current temporary rewrite was configured separately for the interim pilot.

## 8. Validation evidence and limits

### Verified during this work

- Backend race tests passed with the isolated PostgreSQL test database; Go vet passed.
- All 17 frontend API/date/voice transport tests passed.
- Type generation check, TypeScript build, Vite build, and whitespace checks passed.
- Local OIDC login and onboarding for user and guardian roles.
- Mood and preference persistence after reload; memory creation.
- Guardian invite, acceptance, approval, grant, and revocation.
- Export required recent authentication, reached ready state, and downloaded actual data.
- Failed writes showed errors without claiming success.
- Unavailable voice returned an error rather than a fake conversation.
- Restored dashboard check-in persisted after reload.
- User and guardian routes checked at mobile and desktop sizes without horizontal overflow.
- Rapid route checks hit the expected rate limit; slower checks passed without weakening it.
- Real deployed Google login returned to onboarding and stayed authenticated after reload.
- Public health endpoint returned `200` JSON; unauthenticated profile `401` JSON; auth start `200` JSON with `no-store` caching.

### Not established by these checks

- Full production user/guardian lifecycle after real onboarding.
- Real microphone-to-provider-to-speaker quality, latency, and long sessions.
- Live WebSocket transport through the deployed Vercel route.
- Push notification delivery.
- Physical device pairing, audio, battery, mute/stop latency, or OTA behavior.
- Independent backup storage and restore testing.
- Complete readiness for minors or public safety use.

Lint still reports warnings in existing React component patterns. The build reports a mixed static/dynamic import warning. Passing the build is not proof of live feature readiness.

## 9. IoT firmware

See [IoT README](../iot/README.md) and [firmware setup/release guide](../iot/docs/firmware-setup-and-release.md).

The reference firmware targets ESP32-S3 with external RAM, I2S microphone, and I2S amplifier. Capture is 16 kHz mono PCM; playback is 24 kHz. It includes framing/state logic, bounded queues, secure BLE provisioning, WSS transport, physical controls, encrypted NVS, and signed OTA handling.

All GPIOs default to unset values. The default endpoint is invalid and OTA is disabled. These are intentional release gates. The final PCB, wiring, battery/charger, enclosure, and controls were not validated on hardware.

Host protocol test commands are in `iot/README.md`. They were not rerun during this handoff; do not describe them as newly verified here.

## 10. Known issues and release priorities

1. **Publish the current work.** Review all modified and untracked files, commit the intended integration/design changes, and create a PR. No current frontend integration PR exists.
2. **Replace the Quick Tunnel.** Use a stable HTTPS API endpoint and update Vercel rewrites. Confirm WebSocket upgrades end to end.
3. **Make runtime production settings explicit.** Review and apply the production override after backup, with a rollback plan. Retest login and CSRF/origin checks.
4. **Complete real-account validation.** The user must choose profile/consent settings. Then test saved data, permissions, export, logout, and session expiry on the live origin.
5. **Resolve provider quota.** Voice is enabled, with speech input and output verified using a synthetic local browser conversation. Gemini's selected text model exhausted its 20-request daily free quota during testing. Full public microphone/playback remains unverified. Alerts remain disabled and need delivery credentials.
6. **Resolve export contract drift.** Existing export output uses fields such as `format_version` and `mood_entries`, while the documented ExportData schema uses other names. The frontend downloads the opaque file. Any parser needs this difference resolved.
7. **Verify backup recovery.** The backup timer is active; local dumps alone do not protect against VPS loss. Check backup success, independent storage, and restore behavior.
8. **Review credentials securely.** Credentials were pasted earlier in the conversation. Treat affected values as potentially exposed. Rotate through private channels; do not blindly replace data-encryption keys, because existing encrypted records need a migration/key-retention plan. Never copy credentials into this handoff, Git, or frontend build variables.
9. **Complete hardware release gates.** Supply reviewed pins and hardware settings, provision factory credentials privately, then test on the physical device.

## 11. Assets and design history

Local artifact folders:

- `/home/xavrir/Downloads/SOBA-Campaign`
- `/home/xavrir/Downloads/SOBA-Frontend-Preview`
- `/home/xavrir/Downloads/SOBA-design-before-restore-20260912-101226.tar.gz`
- `frontend/design/image-to-code/`
- `frontend/public/images/`

The earlier campaign explored a SOBA-branded box and a real teddy bear with partial transparency showing SOBA inside. These are design references, not verified hardware specifications. The archived redesign is not the current public design.

## 12. Rules for the next developer

- Keep the teammate's design language and real API behavior together.
- Preserve private/permission-limited states; never fill gaps with demo data.
- Do not edit the old checkout by mistake or discard the active worktree's uncommitted files.
- Keep database and identity secrets server-side.
- Do not bypass the API to write frontend data directly to PostgreSQL.
- Preserve existing live data and unrelated VPS services.
- Keep contract changes, generated types, and tests consistent.
- Report local tests, production checks, simulations, and unverified hardware separately.

## Handoff verification

For this document, the active Git state, merged PR list, Vercel project link, VPS release path, running API/database containers, tunnel services, backup timer, and public health response were checked again. Historical functional test results above come from the preceding implementation work; they were not all rerun solely to produce this document.

## September 13: official logo update

The supplied official bear and rounded Soba wordmark now appear in shared navigation, sign-in, dashboard and footer branding. The collapsed sidebar and favicon use the bear alone. The original JPEG is preserved at `frontend/public/images/brand/soba-logo.jpeg`; SVG viewports display it without a redraw. Supporting bear poses remain unchanged. Build and 17 frontend tests pass; desktop sign-in, mobile header and collapsed dashboard were checked in the browser. Deployment `dpl_FtSTbGnuR25G8ghAcUPzwrysg2En` is live at `soba1.vercel.app`. No backend settings changed.

## September 13: Groq LLM deployed

Groq `openai/gpt-oss-120b` is now the active LLM. AssemblyAI STT and Gemini TTS are retained. The adapter uses strict schema output and local validation. No paid plan or payment method was enabled; account billing status was not independently accessible.

All four LLM operations, TTS and transcription passed live locally and from the VPS. The local browser synthetic voice test played a 5.32-second reply and produced a review draft. Full backend race tests with the isolated test database, vet and documentation checks passed. Physical microphone and authenticated public-user voice testing remain unverified.

Current release: `/opt/soba/releases/groq-20260913`. Image: `soba-api:groq-20260913`. Public health is OK. Policy `pilot-v3-assemblyai-groq-gemini` names Groq and requires updated consent. PostgreSQL has the same start time as before deployment. Rollback uses `/opt/soba/shared/.env.before-groq-20260913`, `soba-api:before-groq-20260913` and prior release `voice-20260913-7412dc3c`. Source changes remain uncommitted. See `docs/implementation/Voice-Provider-Setup.md`.

## September 13 update: English-only browser voice

This update supersedes earlier processing-consent and Gemini TTS instructions. The owner removed the separate processing-policy acceptance step and Indonesian language support. Onboarding and settings no longer show those controls. Voice tickets, WebSocket sessions, draft review and device permission checks no longer require stored processing-policy acceptance. Age eligibility, authentication, ownership, deletion checks, explicit journal saving and sharing permissions remain in force. The policy API and historical consent fields remain for compatibility; they do not gate voice.

Migration `004_english_profiles` changes the profile default to en-US and converts existing profiles to English with a version increment. New profile updates reject Indonesian. Existing saved content is preserved.

Gemini TTS returned HTTP 429 during diagnosis. Active speech now uses `TTS_PROVIDER=browser`, with Groq GPT-OSS 120B for checked reply text and AssemblyAI for transcription. No Gemini key remains in the active VPS environment. The browser receives only approved reply text through optional `response.end.fallback_text`; it reads this using SpeechSynthesis, and shows the text when speech fails. A browser speech voice must be available. The local test browser had no voices and reported speech failure correctly, so audible playback is not verified for this release. An IoT device cannot use browser speech: its heartbeat reports voice disabled with this provider.

Active VPS release: `/opt/soba/releases/browser-20260913`, image `soba-api:browser-20260913`. Frontend deployment `EaHU9iipQyF4S1YWgiBS6g2ZZt8u` is aliased to soba1.vercel.app. Health passed, API restart count is zero, PostgreSQL was not restarted, and no profiles remain in a non-English locale. Rollback environment/image are `.env.before-browser-20260913` and `soba-api:before-browser-20260913`; migration 004 is additive and can remain on rollback.

Validation: full backend race suite and vet passed; targeted WebSocket tests cover absent stored consent and browser speech after TTS failure. All 18 frontend tests and the build passed. Browser checks found no language selector or processing-policy card; a synthetic speech turn received a Groq reply and produced a review draft. Physical microphone and audible browser speech remain unverified. Source remains uncommitted.

## September 13: Daniel selected and Orpheus connected

The owner chose Daniel after comparing three generated samples. The backend now supports `TTS_PROVIDER=groq` and `TTS_MODEL=canopylabs/orpheus-v1-english`, uses the server-only Groq key, and fixes speech to Daniel with `[warm]` delivery. Gemini remains disabled. Browser speech is only a fallback on provider failure.

Orpheus accepts 200 characters per call. The adapter splits approved replies at word boundaries into at most 193 text characters plus the direction prefix. It validates WAV PCM as mono 24 kHz/16-bit, including Groq's unknown-length streaming header, buffers a complete reply before playback, and enforces the existing 1 MiB audio bound. Provider error bodies are not logged and quota failures are not retried. A long reply consumes multiple TTS requests; the free account quota still applies.

All backend race tests and vet passed. Live local tests passed for all four LLM operations, Daniel speech and AssemblyAI transcription. A browser synthetic voice turn played 18 audio chunks (3.52 seconds) and generated a review draft, without relying on installed browser speech voices. Physical microphone testing remains separate.

Deployment release: `/opt/soba/releases/daniel-20260913`, image `soba-api:daniel-20260913`. Rollback uses `.env.before-daniel-20260913`, `soba-api:before-daniel-20260913` and release `browser-20260913`. No frontend release, database migration, or processing-policy acceptance was added for the voice selection. Source remains uncommitted.

## To do: mood-aware Personal mode

Requested by the owner for later implementation; not implemented or deployed.

- Add an explicit “Use my mood history” preference.
- When enabled in Personal mode, give the AI a bounded set of recent owner check-ins, including their dates.
- Describe these as self-reported moods; ask how the person feels now instead of assuming a past check-in is current.
- Keep saved mood history out of Private mode.
- Do not overwrite mood entries with AI guesses. Any suggested mood entry requires owner confirmation.
- Test owner isolation, disabled preference, Private mode, no history, stale history, and deleted entries.

Hands-free conversation is under discussion, not approved for implementation. Options include automatic turn detection after the user starts a session, and local detection of “Hey Soba” in a separately enabled listening mode. Do not infer proximity or identity from microphone volume, and do not send idle ambient audio to cloud providers.

## September 13: start-once hands-free conversation

Implemented and deployed the browser flow: Start voice session requests microphone access and starts the first turn automatically. After a reply, the browser waits for all PCM sources to finish (or browser speech to end), then waits 300 ms before opening the next turn. The microphone track is disabled while SOBA processes and plays replies. Mute persists across turns; muted input sends silence, not microphone samples. End and review prevents further turns. A 60-second period without transcript activity ends the session. Empty final transcripts resume listening without waiting for a nonexistent response. The existing manual Finish speaking control remains available.

Verification: all 23 frontend tests passed, production build passed, and a real browser AudioWorklet check with synthetic microphone input and a mocked WebSocket completed two automatic turns and checked mute, unmute and finish. This was not a physical-microphone or live-provider conversation test. No backend or database change was required.

Vercel deployment: dpl_6R4i69JG7Fqr6Guowb2MiQDmpyhA, alias https://soba1.vercel.app. Source remains uncommitted. Mood-aware Personal mode and local wake-word detection remain TODO items; this change does not implement either. No interruption while SOBA speaks is supported in this first version.

## September 13: local wake phrase and mood-aware replies

The earlier TODO items are implemented and deployed. Talk to SOBA now has Enable Hey Soba. It requires on-device browser speech recognition (`processLocally=true`), checks availability and installs the local English language pack if needed. There is no remote idle-recognition fallback. Unsupported browsers retain manual start. Only the complete phrase “Hey Soba” starts a conversation, after recognition releases the microphone. Wake listening returns after a completed conversation while enabled. Hiding the page or navigating away disables wake listening; microphone permission and initial enable remain required. This uses local speech recognition rather than a trained keyword model, so recognition quality and platform support remain browser-dependent.

Personalization now includes Use my mood history in Personal mode, default false. Migration 005 adds the preference. Each Personal reply reads at most seven own check-ins from the past seven days, excluding future timestamps, and only while the preference is enabled. Private mode does not query mood context. The reply model receives labels and UTC timestamps as self-reported history; instructions prohibit diagnosis, assumptions about present mood, and claims of automatically changing saved moods. This feature does not automatically record or overwrite moods.

Validation: full backend race tests passed with the isolated PostgreSQL test database; focused auth, conversation and safety tests plus vet passed after final tests were added. Tests cover preference persistence, owner isolation, disabled preference, Private mode, stale and deleted records, bounds, and dated context in the Groq request. All 28 frontend tests passed; wake tests mock recognition and verify local-only options, phrase matching, cancellation, and unsupported browsers. The real test browser exposes local recognition and reports its English pack as downloadable. No physical-microphone wake recognition test has been completed.

Backend release: /opt/soba/releases/mood-wake-20260913, image soba-api:mood-wake-20260913. Migration applied; PostgreSQL start time remains 2026-09-07T11:04:16.253686525Z. Rollback image soba-api:before-mood-wake-20260913 and prior release daniel-20260913 remain available; additive column can remain during rollback. Vercel deployment dpl_HiNs4dMSqwLUpk1zcSNgjLWszacH is aliased to https://soba1.vercel.app. Live bundles and backend readiness were checked. Source remains uncommitted.

## September 14: transcription cut-off and transition audio fixes

A live synthetic Daniel recording was cut at “Take your time” with the provider defaults. A retry transcribed the complete recording, showing intermittent early endpointing. The backend now sends min_turn_silence=1200 and max_turn_silence=3600 for AssemblyAI. English-only support remains intentional.

The browser now captures active-session audio through connection transitions. Audio waiting for input.ready is buffered, capped at ten seconds, and drained in ordered five-frame batches every 20 ms. Explicit Finish speaking drains queued frames before input.end. During an outstanding reply, a 400 ms local pre-roll and 180 ms of sustained signal above RMS 0.025 detect an interruption. The browser stops playback, requests response.cancel, retains that speech and sends it when the next turn is ready. This is an energy-based detector using browser echo cancellation, not speaker identification. Mute discards buffered audio; closing releases capture and clears buffers. Buffer overflow gives an explicit error rather than silently dropping words.

Verification: the same complete recording succeeded in three consecutive live provider tests locally and a fourth test from the VPS using its configured credential. None reproduced the earlier cut-off. All 31 frontend tests passed; the affected voice tests passed again after reply cancellation was added. Speech package race tests, vet, and the production frontend build passed. A browser test with a real AudioWorklet, synthetic microphone and mocked server verified transition buffering, interruption and mute. Physical microphone, quiet speech and speaker-echo behavior remain unverified; no claim of universal recognition accuracy is made.

Backend release/image: transcription-20260914 / soba-api:transcription-20260914. Rollback image: soba-api:before-transcription-20260914; previous release: mood-wake-20260913. No database migration. Final Vercel deployment: dpl_2W1Z25fYJQvjTaaUMbchqzcX6iV6 at https://soba1.vercel.app. Live frontend buffering/cancellation code and backend readiness checked. Changes remain uncommitted.

## September 14: direct request handling

Removed mandatory reflection/questions and mandatory mood check-ins from reply instructions. Listen-first now prevents unsolicited advice, while explicit safe requests are answered directly. The runtime policy and reply checker use the same rule; safe fiction is allowed without false claims about the AI's identity. Safety and private-data restrictions remain.

Five live Groq pipeline cases checked: a bedtime story, a simple explanation, requested desk-organizing steps, listening without advice, and a medication-dose request. The first four returned normal approved replies; the medication request used the safety fallback without giving a dose. Safety/conversation tests, race tests, vet, and diff checks passed. Database integration tests were not run for this prompt-only change. Voice output still has its existing 600-character limit; this is not long-form storytelling support.

Backend release/image: direct-replies-20260914. Rollback image: soba-api:before-direct-replies-20260914. No frontend deployment or database migration. Public readiness passed after restart. Source remains uncommitted.

## September 14: 90-second speech and replay

Groq Daniel output now permits 90 seconds of 24 kHz mono 16-bit PCM (4,320,000 bytes). The 600-character reply limit remains. Browser audio retention uses the same duration bound; retained audio is cleared when the session closes. Paused audio or a browser speech error offers Play reply again while the session remains open. Replay resumes the audio context from the click. The inactivity timer pauses during replies so it cannot cut off a long story.

Validation: speech race tests accept 30/90-second WAV output and reject 91 seconds without partial output. Frontend suite passed 33 tests; after the inactivity correction, all 17 voice tests passed, including the new timer test. A real Chromium AudioContext test with synthetic PCM confirmed paused playback, replay, and playback completion. These were not iPhone or live microphone tests. The exact Willow story live synthesis attempt hit Groq HTTP 429, so a new Daniel recording remains unverified until provider capacity is available. Backend release audio90-20260914 is healthy; rollback image soba-api:before-audio90-20260914. No database changes. Source remains uncommitted.

Final frontend deployment: dpl_D6RKzFEmVfy1nmo4jZQY6aG3mwJM at https://soba1.vercel.app. Vercel production build passed. Live replay control and public readiness checked.

## 2026-09-15: Puck on the Tencent VPS

Active TTS is now self-hosted Kokoro `am_puck`, with sentence/word-bounded streaming and no external TTS key. AssemblyAI STT and Groq GPT-OSS-120B remain active. The API runs release `puck-20260915`; the private speech container is `soba-kokoro-1` with no public port. Include `deploy/kokoro/compose.yaml` in deployment commands. Model files live outside the repository in `/opt/soba/shared/kokoro`.

See `deploy/kokoro/README.md` and `docs/implementation/Voice-Provider-Setup.md` for limits, measured latency, validation, and rollback. Provider round-trip and public readiness passed; physical-device playback remains a separate check. These source changes were deployed before Git publication.
