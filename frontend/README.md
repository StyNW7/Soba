# Frontend

The Soba web app: the public marketing site plus two authenticated dashboards — one for the
person using Soba, one for a parent or guardian supporting them.

**Status: scaffolded and running against mocked data.** No backend calls yet.

## Stack

| | |
| - | - |
| Framework | React 19 |
| Build tool | Vite |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3 |
| Routing | React Router |
| Charts | Recharts |
| Icons | Lucide React (no emoji anywhere in the UI) |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build
```

## Demo accounts

Authentication is mocked and persisted in `localStorage`. The login page has one-tap
shortcuts, or sign in manually:

| Role | Email | Password |
| - | - | - |
| User | `user@soba.demo` | any 6+ characters |
| Guardian | `guardian@soba.demo` | any 6+ characters |

Signing up with any other email creates a user-role account.

### Dashboard sidebar

The desktop sidebar collapses to a 76px icon rail. Toggle it with the handle on the
sidebar edge, the button in the header, or **Ctrl/Cmd+B**. Collapsed state persists per
device, and the content column widens from 1400px to 1560px so the extra room is used
rather than left as margin. Below `lg` the sidebar is a drawer, with bottom navigation and
a "More" sheet.

### Feature coverage against the docs

Traced to the requirement IDs in [`../docs/Notion-Source-Notes.md`](../docs/Notion-Source-Notes.md):

| ID | Feature | Where |
| - | - | - |
| C1–C3 | Voice conversation, adaptive response, personalization | `/app/user/soba`, `/app/user/personalization` |
| C4 | Conversation memory, permission-gated | `/app/user/privacy`, memory-use toggle in Personalization |
| C5 | Grounding support | `GroundingPlayer`, shared by Toolkit and Talk to Soba |
| C6 | Safety detection | Mode detection in Talk to Soba |
| C7 | Human connection | `ContactRequestModal` — select, preview, confirm, status |
| U1 | My Soba: pairing, status, unpair | `/app/user/device`, `PairDeviceModal` |
| U2, U4 | Mood dashboard and patterns | `/app/user`, `/app/user/mood` |
| U3 | Journal from saved conversations | `/app/user/journal`, `SessionReview` |
| U5 | Wellbeing toolkit | `/app/user/toolkit` |
| U6 | Circle of Trust, guardian invite code | `/app/user/circle` |
| U7 | Professional support and referrals | `/app/user/support` |
| U8 | Personality, voice, interaction preference | `/app/user/personalization` |
| U9 | Memory and privacy controls, export, delete | `/app/user/privacy` |
| G1–G6 | Pulse, trends, alerts, reach out, coach, connections | `/app/guardian/*` |
| F1 | Onboarding, profile, consent, pairing, guardian link | `/signup`, `/onboarding`, device and circle pages |
| F3 | Normal / Support / Safety conversation modes | Mode strip in Talk to Soba |
| F4 | Structured summary and per-item consent | `SessionReview` |

### Conversation modes

Talk to Soba implements all three modes from the flow document. **Normal** is everyday
conversation. **Support** offers grounding before continuing. **Safety** stops offering to
be the only support and routes to a person. The mode strip above the transcript shows
which one is active, and the two demo chips trigger Support and Safety respectively.

### End-of-conversation review

Ending a session produces a structured summary — mood, topic, reflection, insights, safety
level — with three independent choices that all start **off**: save to journal, save the
mood entry, and select individual memory candidates. The draft carries a visible expiry
countdown and is discarded rather than saved if it lapses. Turning everything off is the
same as discarding.

### Safety escalation demo

On **Talk to Soba**, the "Demo: serious signal" chip (or typing a phrase like
"I don't want to be here anymore") triggers the escalation architecture:

1. Soba switches to Safety Mode and the UI shifts to muted terracotta.
2. A safe, non-clinical response is shown alongside human-support actions.
3. A guardian notification and an open safety alert are created.
4. Signing in as the guardian shows the active alert on the overview and alerts pages.

The demo never generates harmful content; it demonstrates the routing, not the risk.

## Deploying to Vercel

This is a monorepo, so the Vercel project must point at this directory.

**Project settings → General → Root Directory: `frontend`**

Everything else is handled by [`vercel.json`](vercel.json), which overrides whatever is set
in the dashboard:

| Setting | Value |
| - | - |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

### Why deep links used to 404

Soba is a single-page app: React Router resolves `/support` in the browser, and the only
HTML file that exists on disk is `index.html`. Opening `/` worked because a request for a
directory falls back to its `index.html`. Refreshing on `/support` asked the CDN for a file
at that path, which does not exist, so Vercel returned its own 404 before any JavaScript
ran.

The `rewrites` rule in `vercel.json` serves `index.html` for any path that is not a real
file, letting the router take over on the client:

```json
{ "source": "/((?!assets/).*)", "destination": "/index.html" }
```

Static files still win, because Vercel checks the filesystem before applying rewrites.
`/assets/` is excluded deliberately: a missing hashed chunk (typically stale HTML after a
redeploy) should return a real 404 rather than `index.html` served with a JavaScript MIME
type, which fails with a far more confusing error.

Unknown routes still render the in-app 404 page, which is normal SPA behaviour — the
response status is 200 and React Router decides what to show.

### Caching

Hashed files under `/assets/` are immutable and cached for a year. `index.html` is set to
`must-revalidate` so a new deploy is picked up immediately instead of serving stale HTML
that references deleted chunks.

### Node version

`engines.node` is `>=22.12.0`, matching Vite 8's requirement. If a build ever fails with a
Vite engine warning, check **Project settings → Node.js Version**.

## Routes

**Public** — `/`, `/about`, `/how-it-works`, `/features`, `/safety`, `/support`
**Auth** — `/login`, `/signup`, `/onboarding`
**User** — `/app/user` plus `soba`, `mood`, `journal`, `toolkit`, `circle`, `support`,
`device`, `personalization`, `privacy`, `settings`
**Guardian** — `/app/guardian` plus `wellbeing`, `trends`, `alerts`, `reach-out`, `coach`,
`safety`, `settings`

`ProtectedRoute` redirects unauthenticated visitors to `/login`; `RoleRoute` sends a user
who lands on a guardian route (or the reverse) back to their own dashboard.

## Structure

```text
src/
├── components/
│   ├── ui/          Button, Field, Card, Badge, Modal, Controls, Feedback, Brand
│   ├── charts/      Recharts wrappers and the shared chart theme
│   ├── landing/     Navbar, Hero, marketing sections, device mockups
│   ├── dashboard/   Shell, nav config, notifications, alert banner, pairing, requests
│   └── voice/       Voice orb, waveform, grounding player, session review
├── context/         AuthContext, AppDataContext, PreferencesContext, ToastContext
├── data/            Mock datasets (mood, journal, circle, professionals, device, …)
├── layouts/         PublicLayout, AuthLayout, User/Guardian dashboard layouts
├── pages/           public/, auth/, user/, guardian/
├── router/          Route table and access guards
├── types/           Shared domain types
└── lib/             cn(), storage helpers, formatting
```

State that a backend would eventually own lives behind `AppDataContext` and
`AuthContext`. Swapping the mocked promise bodies for API calls should not require changes
in the pages.

## Design system

Brand palette, defined as Tailwind tokens in `tailwind.config.js`:

| Token | Hex | Use |
| - | - | - |
| `cream` | `#F2F5E2` | Large soft backgrounds, secondary cards |
| `custard` | `#E3DEA4` | Highlighted sections, chart fills |
| `apricot` | `#D4954D` | Primary CTA, active states, primary chart series |
| `brown` | `#775533` | Dark text, navigation, dark cards |
| `terracotta` | `#B5654F` | Safety mode and urgency — muted, never alarming |

Headings use DM Serif Display; body and dashboard UI use Inter. Corners are `rounded-2xl`
to `rounded-3xl`, shadows are warm and subtle. Motion is deliberately calm and respects
`prefers-reduced-motion` as well as an in-app reduce-motion toggle.

## Accessibility

Semantic landmarks and headings, skip links on both shells, focus-trapped dialogs with
focus restoration, keyboard-operable custom controls with `aria` state, 44px minimum tap
targets in mobile navigation, and charts paired with readable data tables. Settings expose
text size (default/large), higher contrast, and reduce motion; all three persist per
device.

## Responsiveness

Desktop uses a 272px sidebar that collapses to a 76px rail; tablet collapses it into a
drawer; mobile uses bottom navigation capped at five destinations with a "More" bottom
sheet. Tables become cards or scroll containers below `sm`. Nothing overflows horizontally
at 390px.

## Constraints

- **The frontend never calls AssemblyAI or the LLM directly.** Everything goes through the
  Go backend, which is the single place safety checks and retention rules are enforced.
- **No API keys in the browser.** `VITE_*` variables are compiled into the bundle and are
  public — treat every one of them as visible to the user.
- The backend base URL comes from `VITE_API_URL`. See [`../.env.example`](../.env.example).

## Tone

This is a mental health product. The interface should feel calm and unhurried — quiet
colours, generous spacing, no nudges engineered to pull someone back in. Copy shows
patterns, never diagnoses: "your recent check-ins have felt more difficult", never "you
have depression".

Read [`../docs/architecture.md`](../docs/architecture.md),
[`../docs/conventions.md`](../docs/conventions.md), and
[`../docs/safety-and-privacy.md`](../docs/safety-and-privacy.md) before extending this.
