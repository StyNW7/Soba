# SOBA image-to-code extraction

Eight complete section images were generated and visually inspected before frontend changes. Four early drafts repeated the teddy in text sections; fresh text-only images replaced them. The selected images are stored here. Generated originals remain in the generator directory. References are not used as flattened webpage backgrounds.

## Shared system

Warm ivory #faf7f0, chocolate #493322, caramel #956d4c and sand #efe5d7 form the common palette. Display letters have soft rounded ends, heavy weight, tight tracking and approximately 1.05 line height. Locally bundled Nunito 900 is the closest simple translation; Manrope remains the body/control face. Exact font identity cannot be recovered from generated pixels. Desktop body is 18px with 1.5–1.65 line height; mobile body is 16px. Use 64–80px desktop gutters, a 1440px outer maximum, and 24px mobile gutters.

Section headings are 56–68px, hero 84–96px, closing 76–80px. Controls are 52–56px tall, fully rounded, with 24–32px horizontal padding and bold 16px labels. Primary is dark chocolate/white; secondary is transparent with a 1px chocolate outline. The lighter generated closing button is standardized to the dark primary fill for readable white text. Static images cannot specify hover/focus behavior; retain visible focus and modest color transitions. Use 1px sand rules and flat backgrounds; raster grain is not an implementation requirement.

Keep existing logo identity, navigation labels, routes, safety/privacy text and forms. Generated uppercase SOBA, repeated navigation and “Support center” do not change those requirements. Generated feature claims are not product requirements. Product photos remain clearly documented as concepts.

## 01 Hero

Priority: two-line “A softer place / to land.” with caramel second line and full seated teddy. Kicker: “Listen. Support. Connect.” Body: “A voice-first companion for whatever you’re feeling. Speak openly and connect with the people who matter.” Actions: solid “Meet Soba” and underlined “See How It Works” with arrow. One horizontal navigation row above a fine rule.

Photo occupies just under half the available width. Only its top-left corner has an approximately 100px curve; other corners are square, with no tilt. Text is vertically centered. Approximate gaps: kicker-heading 28px, heading-body 32px, body-controls 36px. Use a near-equal grid with 32–48px gap and photo capped around 580px for small laptops. Keep the current Three.js scene inside this frame. On mobile put text before photo, with heading around 46px; both controls precede the photo.

## 02 Principles

The compact band between the two rules is the section; blank reference canvas above/below is not extra page padding. Four centered equal columns with vertical separators, outline icons, bold labels and descriptions. Exact existing titles/copy are readable. Use about 42px icons, 20px headings, 16px body, 16px icon-to-heading gap, 8px before description and 40px vertical padding. Two columns on mobile; one at 360px and below.

## 03 Purpose

Refined image is text-only, left aligned. Two-line heading with caramel second line, then a two-line introduction. Four items below a 64px gap form a 2x2 grid. Each has a large caramel number left of its title and body. Numbers are about twice title size. Thin rules separate rows. Translate to 56px numbers, 26px titles, 18px copy, 80px number column. Preserve all existing gap titles/descriptions. Mobile stacks items and retains numbers; headings wrap naturally.

## 04 Journey

Equal text/photo columns. Two-line heading with caramel second line. Rounded rectangle portrait with 16px corners replaces the arch. Generated extra slogan/repeated navigation are outside the section content and omitted. Accordion uses numbered 36px circles, 28px titles, plus/minus at the far edge and thin horizontal rules. Active number is filled; inactive is outlined. Body and check list align with the title after the circle. Photo is approximately 4:5. Preserve full support/connect copy, use the shorter generated Listen introduction. Buttons keep expanded state and associated regions. Minus closes its region and retains the last selected photo. Mobile places photo after accordion.

## 05 Ecosystem

Two-line heading above macro photograph and unboxed product details. Photo occupies approximately 64% of row; details have a 48px gap, 34px title, 18px subtitle, 16px feature rows with small icons and an outline action. Square image corners, no enclosing card. App row uses only a top rule, 40px two-line heading at left (second line caramel) and six features in two columns at right. Preserve existing app explanation even though absent in reference. Mobile stacks image, details and app columns.

## 06 Roles

Equal open columns on sand, one vertical rule, 64–80px inner separation. Labels 16px; titles about 48px. Left title has three explicit lines: Your feelings. / Your space. / Your choice. Right title has two: Support without / invading privacy. Intro follows after 24px; features after 28px. Icons are brown outline strokes without boxes. Added generated feature descriptions are not verified; keep original feature labels only. Bottom statement is centered, about 32px with an 18px explanation. Mobile stacks roles and changes the central rule to horizontal.

## 07 Safety

Left 45% heading/body/action; right approximately 50% open 2x2 icon/title/body grid. Heading “AI should know / its limits.” is about 62px. Preserve all safety copy exactly. Icons about 44px, titles 24px, body 18px, no cards. Bottom horizontal rule introduces a 46px caramel statement “Some conversations should lead to a human.” It can wrap at small widths. Action uses outline style. Mobile stacks introduction before the feature grid; smallest widths use one feature per row.

## 08 Closing

Centered two-line invitation, no photograph and no enclosing rounded card. 80px heading with caramel second line. Body: “You don’t have to know exactly what to say. Start where you are.” Primary/outline controls follow after 36px, lock/privacy line about 32px later. Approximately 120px vertical padding. Retain the full existing footer/legal links rather than duplicate the generated miniature footer. Mobile uses about 40px heading, 48px controls and natural wrapping.

## Validation target

Compare desktop and full-page browser screenshots with all eight references for hierarchy, frames, layout and text size. Check six public routes at 320px, 768px and 1440px. Exercise menu, CTA destinations, accordion open/close, persisted reduced motion and WebGL fallback. Run production build, lint and diff whitespace check. This visual work does not verify backend integration or existing marketing claims.

## Approved modern-product revision

The user selected warm modern product styling and accepted the Mindly/Moooi/Lusion reference direction. References 09 and 10 supersede the earlier hero/product styling. Keep Manrope with 700–750 display weight as explicitly requested; ignore the generated rounded-font drift. The hero retains the single curved corner and two-line composition, with a text-link secondary action. Product reveal uses #30241e background, cream text, a left portrait occupying about 55%, and right headline plus three ruled controls. Keep about 64px between columns. Headlines are 52–64px, stage heading 32px, body 18px, labels 16px. Selected control has a cream label and arrow; others use muted sand. Outline CTA is cream. The three separate product-only assets show the full opaque teddy, tactile paw detail, and softly ghosted internal device. The texture diagonal and device close-up provide meaningful camera-distance changes. Implement as three native-scroll chapters with a sticky image on desktop and directly selectable stages on mobile/reduced motion. Do not use the UI reference as an asset. Original eight references still guide the open text sections, with the same cleaner Manrope type substitution.
