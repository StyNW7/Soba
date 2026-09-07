# Frontend implementation specification

Normative for TD 2.0. API operation names below match [openapi.yaml](contracts/openapi.yaml). Requirements refer to the [Notion source notes](../Notion-Source-Notes.md).

## FUI1. Stack and file structure

Use React, Vite, TypeScript with strict mode, Tailwind, React Router, and TanStack Query. Use Capacitor for the iOS and Android shells. Pin compatible versions in the lockfile at implementation time. Use generated API types from OpenAPI; do not maintain handwritten copies of server DTOs. Use local component state for forms and TanStack Query for server state. No Redux is required.

```text
frontend/src/
  app/{router,providers,role-layouts}.tsx
  api/{generated,client,errors}.ts
  features/auth/
  features/onboarding/
  features/devices/
  features/mood/
  features/journal/
  features/toolkit/
  features/contacts/
  features/guardian/
  features/privacy/
  features/support/
  components/{Button,Field,ErrorState,EmptyState,ConfirmDialog}.tsx
  native/{provisioning,secure-storage,push,links}.ts
  locales/{id-ID,en-US}.json
```

Each feature owns its screen, query hooks, form schema, and component tests. Shared components own presentation only. The client wrapper adds request ID handling, auth, CSRF for cookie writes, and stable idempotency keys per user action. Do not put service keys in `VITE_` variables.

## FUI2. Navigation and common states

Public routes: `/login`, `/auth/complete`, `/onboarding`, `/deletion-status`. User tabs: Home, Journal, Toolkit, Circle, Settings. Guardian tabs: Pulse, Alerts, Coach, Connections. An account with both roles can switch layouts. Persist the last selected role locally, but clear all subject data on logout.

All private routes call `getProfile`. Unauthorized routes go to login; incomplete profiles go to onboarding. A guardian URL alone never grants access. If no subject is selected, show the authorized subject picker. Never use the first subject implicitly for a destructive action.

Each asynchronous screen has initial loading, ready, empty, recoverable error, unauthorized, and offline states. Use a labeled progress indicator; do not show fabricated values while loading. A 401 triggers one serialized token refresh on mobile. If it fails, sign out. Retry GETs at most twice for transport/503 errors; do not retry 400/403/404. A user write retries only with the original idempotency key and identical payload.

Do not use optimistic updates for saves, consent, contact links, device claiming, notifications, or deletion. Show success only after the server response. On 409 reload the item, preserve the user's edit in memory, and ask them to review it. Never overwrite the new version automatically.

Cache private responses in memory only. Disable query persistence and service-worker caching of API responses. Scope every query key by authenticated profile and, when applicable, guardian subject. Clear affected caches after mutations. On role switch clear the departing role's sensitive queries. On app foreground refetch profile, grants, and the current subject before showing cached guardian content. Hide private content while this check runs.

## FUI3. Screen contracts

| Screen / route | Data and actions | Validation and state rules | Requirement |
| --- | --- | --- | --- |
| Login `/login` | `startLogin`, system browser, callback/mobile exchange | Show cancellation without creating profile data. Show a retry for expired login. No embedded password form | F1 |
| Profile `/onboarding/profile` | `getProfile`, `updateProfile` | Name 1–80, locale id-ID/en-US, valid timezone, roles, age band. Server computes eligibility. Shared phone optional E.164 | F1 |
| Consent `/onboarding/privacy` | `getPolicy`, `setProcessingConsent` | Explain processors and retention. Checkbox starts unchecked. No microphone capture before allowed status. Under-18 blocked state explains pilot eligibility | F1, U9 |
| Setup `/onboarding/device` | Pair now or skip to app | Skipping does not claim a device. App features can work without hardware | F1 |
| Pair `/devices/pair` | Scan QR or enter device ID; create/get claim; native provisioning; poll claim | Invalid code inline. Five-minute countdown. Wrong PoP, denied Bluetooth, wrong Wi-Fi, cloud timeout, owned device each have distinct retry actions | U1, F1 |
| My Soba `/devices` | `listDevices`, rename, unpair | Show battery with report time, last seen, online/offline, firmware. Empty state links to pair. Unpair dialog identifies exact device | U1 |
| Home `/app` | `getMoodTrends`, `listReviewSessions`, `listDevices` | Show latest confirmed mood and available summary review. No entries means no entries, not neutral mood | U2 |
| Check-in `/mood/new` | `createMoodEntry` | Single explicit label, timestamp defaults now. Can cancel. No text journal is created | U2 |
| Mood history `/mood` | `listMoodEntry`, edit label, delete | Mark check-in vs conversation. Delete confirmation identifies date and label. Pagination preserves order | U2, U4 |
| Mood patterns `/mood/patterns` | `getMoodTrends` | 7/30/90-day presets; timezone visible; no diagnostic score; accessible table alongside chart | U4 |
| Summary review `/sessions/:id/review` | `getSessionDraft`, `saveSession`, `discardSessionDraft` | Three independent choices off by default. Memory candidates individually selectable. Show expiry countdown. All-off action means discard. On 410 explain draft expired; never claim saved | U3, C4, F4 |
| Journal `/journal` | `listJournal`, detail | Empty state explains that only selected conversations appear. No unsaved transcript search | U3 |
| Journal edit `/journal/:id` | `getJournal`, `updateJournal`, delete | Topic ≤160, reflection ≤3000, ≤5 insights of ≤300. Save version. Text remains local until save | U3 |
| Toolkit `/toolkit` | `listToolkit`, get item | Locale filter, activity category, empty/unavailable state. Expired item removed | U5 |
| Activity `/toolkit/:id` | Step player, pause/resume/stop | Show current step and optional audio. No autoplay on page load. Clear stop control, no forced completion. Completion is local and not a mood entry | C5, U5 |
| Circle `/circle` | Contact list/create/edit/delete, invite | Name and relationship required; phone optional and labeled user-entered. Show unlinked/invited/active/revoked | U6 |
| Accept invite `/connections/accept` | Code entry, `acceptInvite` | Login first, accept identifies inviting subject. Expired/used code has safe error. Acceptance says waiting for user approval | F1 |
| Connection review `/connections` | `listLinks`, approve/revoke | Show accepting identity. Subject approval required. Grants start empty and are configured separately | F1, U6 |
| Sharing `/settings/sharing` | `listGrants`, create/revoke per scope | One switch per scope/person; no “share everything” shortcut. Confirm recipient and scope. Show pending until committed | U9, G6 |
| Professionals `/support/professionals` | `listSupportResources`, details, create referral | Show review date, locale/region, available contact details. External access opens system browser. Do not label as booked | U7 |
| Referrals `/support/referrals` | List/create/update/delete referral | State labels include “reported by you.” Closing a referral is not treatment completion | U7, G6 |
| Personalization `/settings/soba` | Get/set preferences | Calm/friendly/encouraging; marin/cedar reference voice IDs; listen-first toggle; memory-use toggle. Show new version pending on offline device | C2, C3, U8 |
| Memory `/settings/memory` | List/create/edit/delete memory | Show approved facts only; category required; 1–500 characters. Saving a fact and enabling future use are separate actions | C4, U9 |
| Privacy `/settings/privacy` | Processing consent, export, history/account deletion | Explain what each action changes. Export/delete requires fresh login. No checkbox implies retroactive consent | U9 |
| Data job `/settings/data/:id` | Poll `getDataJob` every 3 seconds while visible | Show queued/running/waiting_provider/ready/complete/failed. Export uses authenticated download. Never call waiting_provider complete | U9 |
| Safety plan `/support/plan` | Get/set plan | Up to ten user-controlled steps, each ≤500. Show current sharing recipient list and link to change it | G6 |
| Contact someone `/support/request` | Select active contact, create request, preview, confirm | Show exact recipient, shared phone, fixed message, and expiry. No send before explicit confirmation. Unlinked contact offers OS call/message instead | C7, G3 |
| Request status `/support/requests/:id` | `getSupportRequest`, cancel | Queued, accepted by service, acknowledged, failed, cancelled, expired are distinct. Acknowledged never says “safe” | C7 |
| Guardian pulse `/guardian/:subject/pulse` | `getGuardianPulse`, trends if granted | No authorized subjects: show invitation instructions. Missing scope: show “Not shared.” Never show private journal snippets | G1, G2 |
| Alerts `/guardian/alerts` | `listRecipientAlerts`, explicit acknowledgement | No lock-screen private content. Tap opens authenticated app. Acknowledge is a distinct action | G3 |
| Reach Out `/guardian/alerts/:id` | `getReachOut`, OS dialer or message composer | Call action says “Open phone.” Message stays editable. Missing shared phone offers in-app acknowledgement only | G4 |
| Coach `/guardian/coach` | `listParentCoach`, get item | Reviewed library only, no private content prompt. Expired content not displayed | G5 |
| Connections `/guardian/:subject/connections` | `getGuardianConnectionStatus` | Only granted sections are visible. No inference that an empty section means the user has no support | G6 |
| Deletion receipt `/deletion-status` | `getDeletionStatus` with receipt | Store receipt only for this operation; never expose it in URL query or telemetry. Clear after expiry/completion acknowledgement | U9 |

## FUI4. Exact forms and server updates

Use the OpenAPI lengths and enums directly in form schemas. Client validation improves feedback but never replaces server validation. On 400, map `fields[].field` to the control; show unknown errors at form level. Label required fields explicitly. Submit a full replacement Preferences or ProfileUpdate with its version; PATCH naming in OpenAPI does not permit omission of required fields.

Summary example: the user selects journal, unchecks mood, and selects one memory. Send `save_journal=true`, `save_mood=false`, the displayed mood value, and exactly that memory candidate ID. After success invalidate journal and memory queries, remove the review session, and show two saved items. Do not invalidate mood as if a new mood was created.

When a processing-consent withdrawal is requested, show a dialog that explains recording will stop and saved history will enter deletion. First revoke processing, then create the idempotent history-deletion job. If the second call fails, keep recording revoked and display “Recording stopped. History deletion needs a retry.” This avoids false atomic UI claims for two operations.

Confirm contact request copy must identify the recipient and say what is shared: a request for contact, the user's display name inside the app, and the optional shared phone. Do not attach the conversation, journal, mood trend, or safety classification. The persistent safety-alert grant is necessary but does not replace per-request confirmation.

Changing a saved phone clears no app identity; display that automatic alerts go to the linked SOBA account, while OS call/message actions use the entered phone. Warn about an unverified number in that control, not as a general app banner.

## FUI5. Native interfaces

Define a thin `ProvisioningBridge` with `scan(): DeviceCandidate[]`, `connect(deviceId,pop)`, `setWifi(ssid,password)`, `setClaim(claimId,challenge)`, `getStatus()`, and `disconnect()`. Each rejects with one of permission_denied, bluetooth_off, device_not_found, invalid_pop, wifi_rejected, timeout, cancelled. Implement with Espressif's native provisioning SDK; do not implement Bluetooth encryption in JavaScript. The web implementation returns unsupported and links to mobile setup.

Define `SecureTokenStore` with read/write/clear for mobile auth and deletion receipt. Never store tokens in general preferences. QR permission is requested when the user selects Scan; provide manual input if denied. The QR contains version, device ID, and local PoP; never open an arbitrary scanned URL. Do not send the QR contents to analytics.

Register push only after the user enables notifications. `registerPush` uses one installation UUID and the current FCM token. Re-register on token rotation and login. Unregister on logout before clearing credentials when network permits; backend session/account revocation must still protect alert reads. An installation ID may not be reassigned to another account without explicit re-registration and revoking the prior binding.

On an account switch, delete/regenerate the FCM token through the native SDK and create a new installation UUID. The server rejects an installation ID or token hash bound to another account with 409; it never silently changes the owner. Push text remains generic even if an offline logout could not unregister the old token. Opening an old notification still requires current authenticated recipient authorization.

## FUI6. Accessibility, presentation, and tests

Use semantic headings, labels, focus restoration, and keyboard-accessible dialogs. Never encode mood/status by color alone. Support text enlargement, reduced motion, screen readers, and tap targets of at least 44 CSS pixels. Announce save/error states without moving focus unexpectedly. All displayed timestamps use the profile timezone. Use locale files for English and Indonesian; clinical/support copy requires content review before release.

Use the nearest project DESIGN.md at UI implementation time. This specification fixes behavior and content hierarchy, not a replacement visual system. Do not change visual tokens as part of backend contract work.

Required component/integration tests: each table row's empty/error state; no-save selections; 409 conflict preservation; guardian route subject switching; scope revocation while cached; no voice permission before consent; push permission denial; invitation identity review; no delivered/clinical-resolution wording; keyboard and screen-reader flows. Required device tests: both mobile OS login returns, QR/manual pairing, denied permissions, hotspot loss, app resume, token rotation, and authenticated notification navigation.
