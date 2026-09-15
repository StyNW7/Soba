# Frontend

The Soba web app: the public marketing site plus two authenticated dashboards — one for the
person using Soba, one for a parent or guardian supporting them.

**Status: connected to the Go API and PostgreSQL locally.** Private routes use server data and OIDC sessions. External providers still need deployment-specific verification.

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
npm run dev      # http://localhost:5174
npm run build    # type-check + production build
npm run preview  # serve the production build
```

### Dashboard sidebar

The desktop sidebar collapses to a 76px icon rail. Toggle it with the handle on the
sidebar edge, the button in the header, or **Ctrl/Cmd+B**. Collapsed state persists per
device, and the content column widens from 1400px to 1560px so the extra room is used
rather than left as margin. Below `lg` the sidebar is a drawer, with bottom navigation and
a "More" sheet.

## Backend integration

See [INTEGRATION.md](INTEGRATION.md) for configuration, API coverage, tests, and limits.

## Deploying to Vercel

The current file only deploys the static frontend. It does not connect the API. Configure same-origin API routing before the SPA fallback, including a WebSocket-capable route for voice. See INTEGRATION.md.

This is a monorepo, so the Vercel project must point at this directory.

**Project settings → General → Root Directory: `frontend`**

The static site configuration is handled by [`vercel.json`](vercel.json), which overrides whatever is set
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

Private routes use `pages/connected/`, `api/`, and `AuthContext`. `AppDataContext` is no longer mounted. Older demo pages remain in the source but are not used by the router.

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
- Browser requests use same-origin `/v1`. The local Vite proxy target comes from `SOBA_API_TARGET`. See [`.env.example`](.env.example).

## Tone

This is a mental health product. The interface should feel calm and unhurried — quiet
colours, generous spacing, no nudges engineered to pull someone back in. Copy shows
patterns, never diagnoses: "your recent check-ins have felt more difficult", never "you
have depression".

Read [`../docs/architecture.md`](../docs/architecture.md),
[`../docs/conventions.md`](../docs/conventions.md), and
[`../docs/safety-and-privacy.md`](../docs/safety-and-privacy.md) before extending this.
