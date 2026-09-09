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

### Safety escalation demo

On **Talk to Soba**, the "Demo: serious signal" chip (or typing a phrase like
"I don't want to be here anymore") triggers the escalation architecture:

1. Soba switches to Safety Mode and the UI shifts to muted terracotta.
2. A safe, non-clinical response is shown alongside human-support actions.
3. A guardian notification and an open safety alert are created.
4. Signing in as the guardian shows the active alert on the overview and alerts pages.

The demo never generates harmful content; it demonstrates the routing, not the risk.

## Routes

**Public** — `/`, `/about`, `/how-it-works`, `/features`, `/safety`, `/support`
**Auth** — `/login`, `/signup`, `/onboarding`
**User** — `/app/user` plus `soba`, `mood`, `journal`, `toolkit`, `circle`, `support`,
`device`, `privacy`, `settings`
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
│   ├── dashboard/   Shell, navigation config, notifications, safety alert banner
│   └── voice/       Voice orb and waveform
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

Desktop uses a 272px sidebar; tablet collapses it into a drawer; mobile uses bottom
navigation capped at five destinations with a "More" bottom sheet. Tables become cards or
scroll containers below `sm`. Nothing overflows horizontally at 390px.

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
