# Safety and privacy

Soba is a conversational companion. It is not a medical device, therapist,
diagnostic service, or emergency service. The product must state this clearly
and must not imply professional authority.

## Safety pipeline

Every finalized turn goes through this order:

1. Assess the transcript with the strict safety contract.
2. Route serious or uncertain results to reviewed fallback content.
3. Generate a normal reply only when the assessment allows it.
4. Check the complete reply for medical advice, identity claims, unsafe content,
   privacy leaks, and invalid output.
5. Send text to TTS only after the reply check approves it.

Assessment and reply calls use `store=false`, no tools, bounded input, and
strict JSON schemas. Provider errors do not trigger guessed safety text. The
repository contains no crisis script or clinical claim. A reviewed content
pack must supply the fallback text and must remain approved and unexpired.

Local support resources and helpline details must come from the reviewed import
process. Verify every number, URL, locale, and review expiry before release.
Do not copy an unverified number into code, tests, or default content.

## Consent and age

The initial technical pilot permits eligible users aged 18 and over. Minor
enrollment is disabled and startup rejects an attempt to enable it without a
new reviewed policy. This technical gate does not replace legal, product, or
guardian review for a future young-user release.

Voice processing requires explicit consent for the configured policy version.
Withdrawal cancels active processing and blocks new voice sessions. Guardian
views use explicit grants and expose only approved pulse, trend, connection, or
alert scopes. They do not expose private conversation, journal, or memory text.

## Data minimisation

- Raw audio, prompts, generated replies, and transcript text are transient.
- Saved journal, mood, and memory records are separate choices. A no-save
  conversation has no hidden durable copy.
- Device, session, push, and replay credentials are stored as hashes or
  encrypted short-lived values. Provider keys never reach a device or client.
- Logs contain request IDs, route templates, status, duration, and safe failure
  codes. Never log Authorization, cookies, QR or PoP values, push tokens,
  phone numbers, transcripts, prompts, replies, journals, memories, or provider
  response bodies.
- Export objects are encrypted before they enter the private filesystem volume.
  The volume must not be served by HTTP.

## Deletion and access

History or account deletion cancels in-flight work, removes saved personal
content, and prevents idempotency replay from recreating it. Account deletion
revokes sessions and devices before removing the profile. The short-lived
deletion ledger is operational metadata and does not contain user content.

When `PROVIDER_DELETION_REQUIRED=true`, the local deletion job ends in
`waiting_provider` after local deletion. An operator must complete the reviewed
external-provider deletion process before the job can be treated as complete.
The code does not claim that a provider has deleted data without evidence.

## Device and physical privacy

The microphone must have a visible listening indicator and a local stop or mute
control. Always-on capture is not a default. The device keeps only the cloud
operational credential and uses the backend for provider calls. See
[Hardware](hardware.md) for the unresolved board, battery, microphone, and
enclosure decisions.

## Release evidence

Before real-user operation, record approved policy and content review,
provider data terms and region, Indonesian speech evaluation, response and
cancellation tests, deletion and restore drills, guardian scope tests, and
verified local support resources. A green build alone is not evidence of safe
clinical or hardware behaviour.
