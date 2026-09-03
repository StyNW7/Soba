# Safety and privacy

Read this before building anything that touches what a user says to Soba.

Soba occupies an unusual position: it is a soft toy that people talk to about how they
feel, in their bedroom, possibly at their lowest. That combination — intimate setting,
vulnerable moments, an always-present microphone, and a form factor that invites children
— means ordinary product judgement is not enough. This document is the standard the project
holds itself to.

## What Soba is not

**Soba is not a medical device, a diagnosis, a therapist, or a crisis service.** It does not
treat, and it must never present itself as treating. Any copy, reply, or feature that
implies clinical capability is a bug.

This has to be true in the product, not just in a terms-of-service page nobody reads. If a
user could reasonably come away believing the doll is qualified to help them through a
crisis, the design has failed.

## Crisis handling

People will tell Soba things they have not told anyone. Some of those things will be about
self-harm, suicide, or abuse. **The pipeline must handle this explicitly rather than passing
it to a general chat model and hoping.**

Requirements:

1. **Detect risk language in the transcript before reply generation.** This runs on every
   turn — it is not a feature that can be toggled off.
2. **Route risk turns down a separate, non-generative path.** A crisis response is not
   something an LLM improvises. It is a short, warm, pre-written response that
   acknowledges the person and surfaces real help.
3. **Surface a real, local helpline.** For Indonesia, the Kemenkes SEJIWA mental health
   line is reachable on **119 ext. 8**. Verify this number is current before shipping, and
   verify it again periodically — helpline numbers change, and a wrong number here is worse
   than no number. Any market Soba ships in needs its own verified list.
4. **Never dismiss, minimise, or change the subject.** "That sounds hard, let's talk about
   something else" is a failure mode, not a safe fallback.
5. **Fail toward help.** If the safety classifier is uncertain, treat the turn as risk. A
   false positive costs a slightly awkward moment. A false negative costs much more.
6. **Escalation to a human is a product decision, not a technical one.** Whether a guardian
   or emergency contact is notified — and whether the user knows that in advance — has to be
   decided deliberately, disclosed clearly, and never be a surprise. Surveillance dressed as
   care destroys the trust the whole product depends on.

## Children

A plush doll will reach children whether or not they are the target user. Assume they are
present.

- **Guardian consent** is required before a child's voice is recorded or stored.
- **Replies must be age-appropriate**, given Soba speaks out loud into a room.
- **A child cannot meaningfully consent** to voice data collection. The consent, the
  controls, and the deletion rights belong to the guardian.
- Check what applies in the markets Soba ships in — children's privacy rules are stricter
  than general ones almost everywhere.

## Voice data

Recordings of someone describing their mental state are among the most sensitive data a
product can hold. Treat them accordingly.

**Consent**
- Explicit, informed, and obtained before the first recording — not buried in an install
  flow.
- The user must be able to withdraw it, and withdrawal must actually delete data.

**Visibility**
- The doll must show, physically and unambiguously, when it is listening. A user should
  never have to wonder.
- Always-on listening must be an explicit choice, not a default.

**Minimisation**
- Do not keep raw audio longer than the pipeline needs it. If the transcript is what the
  product uses, discard the audio once transcription completes.
- Decide and document a retention period for transcripts. "Forever by default" is a
  decision, and it needs to be made on purpose if at all. See open question 6 in
  [`architecture.md`](architecture.md).

**Protection**
- Encrypted in transit, encrypted at rest.
- Access to production conversation data is restricted and logged. Nobody on the team
  browses user conversations casually.

**Third parties**
- Audio and transcripts go to AssemblyAI and to an LLM provider. Users must be told this
  plainly.
- Check each provider's data-retention and training terms, and opt out of training on user
  data. Document what each provider does with what we send.
- **Never send user audio or transcripts to a service without deciding, deliberately, that
  it should go there.**

**Deletion**
- The user can delete their history, and it is genuinely deleted — including from backups on
  a defined schedule, not just hidden from the UI.

## Reply safety

Soba speaks out loud. A bad reply is not a bad string in a log; it is a sentence said aloud
to someone who may be alone and struggling.

- Check generated replies before synthesis, not after.
- Never give medical, diagnostic, or medication advice.
- Never claim to be human, and never claim professional qualification.
- When unsure, be warm and brief rather than confident and wrong.

## When adding a feature

Ask, and write down the answers:

1. What new data does this collect, and do we actually need it?
2. Who can see it?
3. What happens if this feature fires during a crisis conversation?
4. What happens if a child uses it?
5. How does the user turn it off and delete what it collected?

If any answer is uncomfortable, that is the signal to redesign — not to ship and revisit.
