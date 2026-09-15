# AssemblyAI and Gemini voice setup

The Go voice flow can select AssemblyAI for streaming transcription and Gemini for structured assessment, replies, reply checks, reflection drafts, and speech output. Existing Deepgram/OpenAI configurations remain supported. No database migration is required.

## Configuration

Set these on the backend, in its private environment file:

```dotenv
STT_PROVIDER=assemblyai
TEXT_PROVIDER=gemini
TTS_PROVIDER=gemini
STT_MODEL=universal-3-5-pro
STT_LANGUAGE=en
TEXT_MODEL=gemini-2.5-flash-lite
TTS_MODEL=gemini-3.1-flash-tts-preview
ASSEMBLYAI_API_KEY=
GEMINI_API_KEY=
VOICE_ENABLED=false
CONTENT_PACK_PATH=
```

The empty values are placeholders. Do not commit credentials or put them in Vite variables. On activation, update `POLICY_VERSION` and `POLICY_PUBLISHED_AT` so users consent to the actual providers. `/v1/policy` identifies the selected providers and models.

For the Vercel frontend, set `VITE_VOICE_ORIGIN` to the public HTTPS API origin before building. HTTP API calls still use same-origin Vercel rewrites. Voice connects directly to that API origin over WSS and sends its short-lived, single-use ticket in the first message. The permanent provider keys remain on the server. The API must allow the frontend origin. A temporary Cloudflare hostname is suitable only for the current pilot and can change on restart.

## Language and voice choices

The AssemblyAI integration is English-only. Its live model's documented 18-language list does not include Indonesian. Indonesian profiles are rejected before browser microphone capture and again during the socket handshake. Device heartbeat reports voice unavailable for unsupported profiles. No account language is changed automatically. Indonesian transcription would require a different streaming provider or a separate non-streaming design with explicit retention and latency decisions.

The existing `marin` and `cedar` preference IDs remain compatible with the database/API. With Gemini speech they map to `Kore` and `Charon`; the UI labels them Soft voice and Deep voice.

## Fallback configuration

On September 13, the project owner explicitly removed the independent-review requirement and requested voice activation. `../../deploy/tencent/voice-fallback.en-US.json` is the owner-authorized pilot pack. Its `Approved` flag records permission to use those fallback responses, not a claim of clinical or independent review. `ReviewExpires` is the configuration refresh deadline. The earlier draft is retained as history. Startup still validates content, locale and expiry, and model replies still pass the existing response checks before speech.

Set `VOICE_ENABLED=true` with the owner-authorized pack and selected provider credentials. Keep the current provider consent requirement. Test the enabled speech flow with synthetic audio and report actual browser microphone/playback coverage separately.

## Checks

From `backend`, with the private provider variables loaded:

```sh
go test -race ./...
go run ./cmd/provider-check -live
```

The live check makes paid provider calls using only a fixed English connection-test phrase. It validates all four structured model operations, generates speech into bounded memory, resamples it to SOBA's 16 kHz input, streams it to AssemblyAI, checks the result, and sends termination. It does not record audio, use real conversations, or print keys. Run database tests with `SOBA_TEST_DATABASE_URL` pointing only to a disposable test database.

The adapters retain SOBA's strict output validators and time bounds. AssemblyAI receives grouped 60 ms PCM frames; the final short frame is padded with silence. Streams are never replayed after failure. Generated audio is checked for the expected PCM format and size before playback.

## September 13 deployment evidence

The provider adapters are deployed on the Tencent VPS in `/opt/soba/releases/voice-20260913-7412dc3c`; `/opt/soba/current` points there. Both credentials are in the private server environment, with AssemblyAI/Flash-Lite/Gemini 3.1 TTS selected as above. The API and database health checks pass, and the database container was not recreated. Policy `pilot-v2-assemblyai-gemini` lists the new processors. The frontend deployment is `dpl_3MiqSWCdXuWwPK2uAKfkx21zbsLh`, aliased to `soba1.vercel.app`, with the direct voice origin set in Vercel.

The live checker passed both locally and on the VPS: all four Gemini structured operations, generated PCM audio, AssemblyAI transcription of that synthetic audio, and termination. Go race tests passed with the isolated PostgreSQL test database; frontend tests and build passed. An additional database test confirms that the AssemblyAI ticket gate rejects Indonesian and accepts English.

Voice was initially deployed disabled. The activation update below supersedes that state.

Rollback copies are the image `soba-api:before-voice-20260913-7412dc3c` and the private environment `/opt/soba/shared/.env.before-voice-20260913-7412dc3c`. The previous source release is `/opt/soba/releases/772f66b`. Preserve these while the new provider setup is reviewed.

## September 13 activation

The owner-authorized pack is installed at `/opt/soba/shared/voice-fallback.en-US.json` and copied into the existing private-data volume as `/app/private-data/voice-fallback.en-US.json`. This JSON file is outside export cleanup's `.enc` namespace. The backend environment has `CONTENT_PACK_PATH` set to that container path and `VOICE_ENABLED=true`. Only the API container was recreated; PostgreSQL kept its September 7 start time. Backend and public readiness returned 200. A browser on `soba1.vercel.app` reached the direct WSS endpoint and received the expected unauthenticated error for an invalid ticket.

The local authenticated browser used the same enabled backend and real providers with a synthetic microphone stream. The received transcript led to 47 playback chunks containing 9.32 seconds of Gemini audio. Physical microphone/speaker quality and an authenticated public conversation were not tested. Only the disposable local test profile was changed to English.

The subsequent review request failed. Follow-up provider requests returned HTTP 429 with `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20, for `gemini-2.5-flash-lite`. The daily free quota is exhausted. New model replies and review generation are limited until quota resets or the account has a higher quota; provider failure can select the prepared spoken fallback. Do not weaken the response checks to save quota. [Google rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) explains that daily quotas reset at midnight Pacific time. No billing setting was changed.

The activation rollback environment is `/opt/soba/shared/.env.before-voice-activation-20260913`. Restore it to `.env` and recreate only `api` with the existing Compose files to return to disabled voice. No image rollback or database change is needed.

## OpenRouter Gemma 4 candidate (not deployed)

The owner requested the 31B free model first, with the 26B free model as the second choice. The backend now has an `openrouter` text adapter, but the live VPS still selects Gemini. The candidate configuration is:

```dotenv
TEXT_PROVIDER=openrouter
TEXT_MODEL=google/gemma-4-31b-it:free
OPENROUTER_API_KEY=
```

The second supported model is `google/gemma-4-26b-a4b-it:free`. Credentials are in the ignored local `.env.providers`, mode 0600. AssemblyAI remains the speech-input provider and Gemini remains the speech-output provider. OpenRouter is used only for assessment, reply, reply check and review draft generation.

The free Gemma endpoints support JSON output without provider-side JSON Schema enforcement. The adapter includes the schema in the system instruction and validates the full schema locally, including required fields and formats, before the existing semantic validators. Duplicate keys, extra fields, incomplete outputs, refusals and error envelopes are rejected. Routing requires the requested parameters, denies provider data collection, selects Google AI Studio and disables automatic provider fallback. Configuration accepts only the two requested free model IDs. Existing time limits are unchanged.

Live tests on September 13: the key was accepted by OpenRouter's account endpoint. The 31B enforced-schema probe returned 404 for unsupported parameters. JSON-mode probes for both models, including the implemented adapter, returned HTTP 429. OpenRouter explicitly reported that 31B was temporarily rate-limited upstream. Neither model completed SOBA's live assessment/reply/check/draft flow, so neither was deployed. Key acceptance does not establish model availability or latency.

Before switching the VPS, the selected model must pass the live provider checker and synthetic browser conversation. Update the displayed provider policy and policy version for OpenRouter consent at deployment. Do not change Gemini TTS or remove response validation to make the text model pass.

References: [31B free model](https://openrouter.ai/google/gemma-4-31b-it:free), [26B free model](https://openrouter.ai/google/gemma-4-26b-a4b-it:free), [structured output support](https://openrouter.ai/docs/guides/features/structured-outputs).

## Provider references

- [AssemblyAI streaming protocol](https://www.assemblyai.com/docs/streaming/api-spec/streaming-websocket)
- [AssemblyAI supported live languages](https://www.assemblyai.com/docs/streaming/multilingual-transcription)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Gemini speech generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation)

## Groq GPT-OSS 120B integration (deployed September 13)

The owner selected Groq `openai/gpt-oss-120b` for the LLM and supplied its key. The backend uses `TEXT_PROVIDER=groq`, `TEXT_MODEL=openai/gpt-oss-120b`, and server-only `GROQ_API_KEY`. AssemblyAI transcription and Gemini speech output remain separate providers.

The adapter uses Groq Chat Completions with strict JSON schema output and low reasoning effort. SOBA also validates outputs locally and retains the existing assessment, reply, reply-check and draft deadlines. Invalid output, refusal, truncation, and rate limits fail closed without automatic retries or paid-model fallback. See [Groq structured output documentation](https://console.groq.com/docs/structured-outputs).

All four live LLM operations passed locally and on the VPS. Gemini TTS and AssemblyAI transcription/session termination also passed in both environments. The local browser test used synthetic input: the reply produced 27 playback chunks (5.32 seconds) and the session generated a review draft. The review UI opened with save options unchecked. This is not a physical microphone or authenticated public-user voice test.

Release `/opt/soba/releases/groq-20260913` is active, with image `soba-api:groq-20260913`. Public health is OK and `/v1/policy` lists Groq under `pilot-v3-assemblyai-groq-gemini`. Existing users must accept current consent. PostgreSQL was not restarted or migrated. Rollback environment: `/opt/soba/shared/.env.before-groq-20260913`; image: `soba-api:before-groq-20260913`; prior release: `voice-20260913-7412dc3c`.

The key is stored only in ignored local provider settings and private VPS settings. No billing plan was changed or payment method added. The Groq console account was not accessible, so its billing-plan state was not independently verified. Free service remains subject to provider request/token limits. AssemblyAI and Gemini TTS have separate quotas.

To repeat the synthetic provider check, load secrets privately and run `TEXT_PROVIDER=groq TEXT_MODEL=openai/gpt-oss-120b go run ./cmd/provider-check -live` from `backend`. Do not print environment files or send actual user content in setup tests.

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

## Azure Andrew (prepared locally, activation pending)

The Azure adapter uses `en-US-AndrewNeural` and returns 24 kHz mono PCM to the existing voice player. It keeps the existing approved-text check, 600-character reply limit, 90-second audio limit, and browser fallback on provider failure. Text is escaped as SSML.

Use an Azure Speech resource on the F0 tier. Set its credentials only in the private server environment:

```dotenv
TTS_PROVIDER=azure
TTS_MODEL=en-US-AndrewNeural
AZURE_SPEECH_KEY=<Speech resource key>
AZURE_SPEECH_REGION=<resource region>
```

Azure access and live synthesis have not been verified. Do not switch the production provider until a real Andrew request succeeds. The adapter does not select or enforce the Azure billing tier; verify F0 in Azure before activation. Keep the resource key out of frontend environment files and Git.

Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech

## Active VPS voice: Puck (2026-09-15)

The Tencent VPS now runs Kokoro v1.0 FP32 with `am_puck` at speed 0.95. Azure Andrew was prepared locally but was not activated. Groq `openai/gpt-oss-120b` remains the LLM; AssemblyAI remains the transcription provider.

Private service: `soba-kokoro-1`, `http://kokoro:8000/synthesize`, no published ports. API release: `/opt/soba/releases/puck-20260915`. Runbook and model checksums: [Self-hosted Puck](../../deploy/kokoro/README.md).

Measured on the 2-vCPU Tencent VPS after the build finished:

| Test text | First audio | Total generation | Audio duration |
|---|---:|---:|---:|
| 44 characters | 1.70 s | 3.40 s | 2.82 s |
| 203 characters | 4.24 s | 12.72 s | 12.07 s |
| 600 characters | 4.08 s | 36.48 s | 35.54 s |

These timings exclude transcription, LLM generation, and browser/network delay. Audio streams in short sections, so playback starts before all sections finish. This is a one-session pilot; CPU contention can cause gaps or fallback. The INT8 model and one-thread variants were tested and were not selected. No physical microphone or iPhone playback test was performed in this deployment.

Go adapter/configuration/app race tests and Python service tests passed. The live provider check passed Groq assessment/reply/check/draft, Puck PCM synthesis, and AssemblyAI transcription/session termination. API readiness passed both on the VPS and through `https://soba1.vercel.app/health/ready`.

Rollback: restore the private environment backup `/opt/soba/shared/.env.before-puck-20260915`, retag `soba-api:before-puck-20260915` as `soba-api`, set `/opt/soba/current` back to `releases/audio90-20260914`, and recreate only `api` with that release's Compose files. Do not restart or remove PostgreSQL. The source changes were deployed before Git publication.
