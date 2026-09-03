# Soba

**Your Mental Health Companion.**

Soba is a soft toy you can talk to. It listens, works out what you said, replies kindly,
and speaks back. Checking in on how you feel becomes as easy as talking to something soft
on your desk. There is also a web app. It keeps your past chats, shows how your mood
changes over time, and lets you manage the doll.

> **Soba is not a medical device, a therapist, or a crisis service.**
> It is a companion. It helps people reflect and notice patterns in how they feel. Read
> [`docs/safety-and-privacy.md`](docs/safety-and-privacy.md) before you build anything that
> touches how users feel. On this project that file is required reading.



## How the pieces fit

```
   ┌──────────┐   audio    ┌──────────┐   audio   ┌────────────┐
   │   Doll   │ ─────────▶ │ Backend  │ ────────▶ │ AssemblyAI │
   │  (IoT)   │            │   (Go)   │ ◀──────── │   (STT)    │
   │          │ ◀───────── │          │   text    └────────────┘
   └──────────┘   speech   │          │                 
                           │          │  ┌────────────┐ 
                           │          │─▶│    LLM     │ 
                           │          │◀─│  (reply)   │ 
                           │          │  └────────────┘ 
                           └────┬─────┘                 
                                │ REST                  
                           ┌────▼─────┐                 
                           │ Frontend │                 
                           │  (web)   │                 
                           └──────────┘                 
```

The doll records your voice and sends it to the backend. The backend turns it into text
with AssemblyAI, writes a kind reply, turns that reply into speech, and sends it back. The
doll says it out loud. Everything gets saved, so the web app can show you your own history.

See [`docs/architecture.md`](docs/architecture.md) for the full flow and the questions
nobody has answered yet.

## Repository layout

| Path         | What lives here                                          | Status              |
| ------------ | -------------------------------------------------------- | ------------------- |
| `frontend/`  | Web app. Past chats, mood over time, doll settings        | Not started         |
| `backend/`   | Go service. Speech, replies, safety checks, storage       | Not started         |
| `iot/`       | Doll firmware                                             | Waiting on hardware |
| `docs/`      | Architecture, speech, hardware, safety, conventions       | In progress         |
| `scripts/`   | Checks you can run yourself before pushing                | Working             |
| `.github/`   | CI. Runs on every push and pull request                   | Working             |

## Documentation

| Document                                                     | Read it when                                       |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)               | You want the whole flow and what each part owns     |
| [`docs/speech-pipeline.md`](docs/speech-pipeline.md)         | You work on audio, AssemblyAI, or speech            |
| [`docs/hardware.md`](docs/hardware.md)                       | You are picking or building the actual doll         |
| [`docs/safety-and-privacy.md`](docs/safety-and-privacy.md)   | You touch how users feel, voice data, or crises     |
| [`docs/conventions.md`](docs/conventions.md)                 | Before your first commit or pull request            |

## Getting started

Nothing is installed, so there is nothing to run yet. To start:

1. Read [`docs/architecture.md`](docs/architecture.md) so you know where your part fits.
2. Read [`docs/conventions.md`](docs/conventions.md) for how we name branches and write
   commits.
3. Read the README in the part you are taking on.
4. Copy `.env.example` to `.env` and add your own keys. **Never commit `.env`.**

```bash
cp .env.example .env
```

## Contributing

Branch off `main`. Keep each change to one part where you can. Open a pull request. The
conventions doc has the rest.
