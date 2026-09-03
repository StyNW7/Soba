# Frontend

The Soba web app: where a user sees their own conversation history, how their mood has
moved over time, and controls the doll and their data.

**Status: not scaffolded.** This directory holds documentation only. Nothing is installed
and there is nothing to run yet.

## Stack

| | |
| - | - |
| Framework | React |
| Build tool | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |

## What it needs to cover

Rough surfaces, in the order they probably matter:

- **Onboarding** — account, consent, and pairing a doll. The consent step is a real feature
  with real requirements, not a checkbox; see
  [`../docs/safety-and-privacy.md`](../docs/safety-and-privacy.md).
- **Conversation history** — what the user talked about with Soba, browsable and searchable.
- **Mood trends** — how they have been over time, drawn from the conversation record.
  Presentation matters here: this is a reflection tool, not a score. Nothing in this view
  should read as a diagnosis or a grade.
- **Doll settings** — name, voice, volume, when it listens, whether it listens at all.
- **Data controls** — export and delete. Deletion must be genuinely reachable, not buried
  three levels into settings.

## Constraints

- **The frontend never calls AssemblyAI or the LLM directly.** Everything goes through the
  Go backend, which is the single place safety checks and retention rules are enforced.
- **No API keys in the browser.** `VITE_*` variables are compiled into the bundle and are
  public — treat every one of them as visible to the user.
- The backend base URL comes from `VITE_API_URL`. See [`../.env.example`](../.env.example).

## Tone

This is a mental health product. The interface should feel calm and unhurried — quiet
colours, generous spacing, no streaks, no badges, no nudges engineered to pull someone back
in. Engagement mechanics that work fine in a consumer app are actively harmful here.

## Getting started

Not scaffolded yet. Whoever picks this up first: create the Vite + React + TypeScript app in
this directory, add Tailwind, commit that as its own change, and update this README with the
real run instructions.

Read [`../docs/architecture.md`](../docs/architecture.md) and
[`../docs/conventions.md`](../docs/conventions.md) first.
