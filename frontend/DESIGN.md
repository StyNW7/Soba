# SOBA public website

## Current direction

Warm modern product design, approved September 10, 2026. Ivory, chocolate and sand surfaces; clean bold Manrope headings; tactile plush product imagery; restrained pointer and scroll motion. Work is local in `design/frontend-local`, based on `7b05da3`. Public pages share styling; authentication and dashboard layouts are outside this pass.

Reference roles:
- [Mindly](https://dribbble.com/shots/26928324-Mindly-Wellness-Platform-Landing-Page): calm hierarchy and supportive tone.
- [Moooi Paper Play](https://www.webbyawards.com/crafted-with-code/moooi-paper-play/): a sequence of distinct product views.
- [My Little Storybook](https://lusion.co/projects/my_little_story_book/): subtle character presence and depth.

The design is original to SOBA. Reference branding, copy and assets are not reused. Generated UI references and extraction notes are in `design/image-to-code/`. The approved modern-product revision at the end of `analysis.md` supersedes the earlier rounded-type proposal. Manrope is used throughout the public content; the existing logo is retained.

## Tokens

- Main background `#faf7f0`; sand surface `#efe5d7`; product scene `#30241e`.
- Main ink `#493322`; secondary ink `#776351`; caramel accent `#956d4c`.
- Dark scene text `#faf7f0`; secondary text `#d0bcaa`.
- Headings: Manrope, weight 700–750. Responsive hero 45–92px; section headings 34–64px; body 16–18px.
- Main outer container max 1440px; desktop gutters 5vw up to 80px; mobile gutters 24px.
- Controls: minimum 48px high and pill-shaped. Clear outline focus.
- Media: single 110px top-left hero corner; 16px journey corners; rectangular product views.

## Page behavior

- Hero has a still photograph and optional photo-based Three.js parallax.
- Trust strip uses centered open columns. Purpose uses a two-column numbered grid, stacked on mobile.
- Listen/Support/Connect uses semantic accordion buttons with plus/minus state and changing photographs. The active row can close, retaining its last photo.
- The chocolate product reveal has three views: full companion, fabric detail, and internal SOBA device. At widths of at least 1024px and heights of at least 800px, normal scrolling selects stages inside a 200vh section with a sticky scene. Buttons can also select each stage. On small viewports or reduced motion, it becomes a compact directly controlled scene.
- Companion and app features appear as separate open columns. Privacy, safety and legal text retain their original meaning and routes.
- Reduced-motion preferences disable animations and scroll staging. Content and controls remain available. No scroll hijacking or automatic audio.

## Product assets

All teddy images are generated product concepts, not photographs of manufactured hardware. The translucent belly illustrates the intended internal device without claiming finalized hardware construction. New reveal imagery is labeled as a product concept in the page.

Existing assets: `soba-studio.webp` for the hero and journey Connect state; `soba-companion.webp` for the linen-chair Listen state; `soba-detail.webp` for Support.

New assets:
- `soba-reveal-companion.webp`: full opaque plush companion on a dark studio background.
- `soba-reveal-texture.webp`: macro fur and stitched paw.
- `soba-reveal-inside.webp`: softly ghosted belly showing the SOBA box and bear artwork.

New assets are WebP quality 82, generated independently from the selected dark product reference; they are not crops of the UI design board. Generated PNG originals remain in the Codex image output directory. Generation intent: product-only 4:5 photographs, tactile cream fur, warm upper-left studio light, chocolate backdrop, no interface/text outside the actual device mark.

## Three.js limits

The hero maps a photo onto a shallow curved mesh; it is not a complete 3D teddy model. Three.js loads dynamically with the still image as fallback. Rendering stops offscreen or in hidden tabs. GPU resources are disposed on unmount. WebGL context loss fades the canvas out and exposes the still photo.

The scene chunk remains about 132 KB compressed and triggers Vite's existing 500 KB uncompressed chunk advisory. The product reveal itself uses CSS image crossfades and normal page scroll, with no additional animation dependency.

## Local preview and validation

Use Node 22.12 or later. On this machine:

```sh
mise exec node@24.20.0 -- npm run dev -- --host 127.0.0.1 --port 5174
```

Verified September 10:
- Production build succeeds; lint exits successfully with 18 existing warnings and none in ProductReveal.
- Six public routes checked at 320, 390, 768 and 1440px, without page overflow or broken loaded images.
- Main action visible at 1280 × 720; keyboard activation opens `/signup`.
- Mobile menu routes to `/safety`; journey opens/closes and changes its image.
- Desktop scrolling selects all three product stages; mobile buttons select stages.
- Persisted reduced motion produces zero canvases and disables scroll staging; controls still work.
- Forced WebGL context loss removes canvas visibility while the loaded image remains.
- `git diff --check` passes.

Screenshots are in `/home/xavrir/Downloads/SOBA-Frontend-Preview/Modern`. The full-page still uses reduced motion so a sticky-scene scroll track does not appear as blank space in the screenshot.

No push or deployment. Frontend authentication/data remain mocked; these checks do not establish live backend integration or validate source marketing claims.

## September 12 integration update

The earlier mock-data limitation above is superseded for the private routes. They now use the Go API and PostgreSQL. See [INTEGRATION.md](INTEGRATION.md) for current validation and external-service limits. The public visual design is retained.

## Original dashboard design with server data

The dashboard uses the repository's original overview layout, cards, page headers, warm palette, quick actions, and voice orb. Check-ins, journal cards, preferences, and guardian summaries use API responses. Charts show mood-label counts instead of the mock wellbeing score. Empty, loading, unavailable, and permission-limited states are explicit.

## September 13: supplied brown bear artwork

The teammate's original layout remains the active design. The earlier Manrope, Three.js and product-photo direction above is historical and does not describe the current public site.

The user supplied `public/images/mascot/pose-sheet.png`. `SobaBear` provides 19 cropped views: a welcome pose, 12 smaller poses, and six expressions. Inline SVG viewports preserve the source pixels and share one downloaded sheet. A color-matrix filter suppresses the light paper background; two clip paths exclude neighboring poses. These are raster-backed SVG crops, not vector redraws. All are decorative and hidden from assistive technology; text labels and control semantics remain intact.

The welcome pose appears in the landing hero. Public page introductions, sign-in, user and guardian headers, journal empty states, the footer and the missing-page screen use suitable poses. Mood options retain the six API labels and use bear illustrations. Safety and urgent-alert icons remain explicit.

Export the individual, self-contained SVG crops and their contact sheet from `frontend`:

```sh
node scripts/export-bears.mjs /path/to/output
```

The exported SVGs embed the original raster sheet. The application uses a shared image instead, so it does not download 19 copies. Local exports are in `/home/xavrir/Downloads/SOBA-Bear-Crops`.

## September 13: official logo

The supplied `public/images/brand/soba-logo.jpeg` is the official logo. The shared `Logo` component displays the original bear and rounded wordmark through SVG viewports, without redrawing the artwork. A cream background keeps it legible on the dark sign-in panel. Compact navigation and the browser icon use the bear alone. The full source, including its tagline, remains unchanged. The brown bear poses remain supporting illustrations.
