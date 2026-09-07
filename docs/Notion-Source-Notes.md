# SOBA — Notion source notes

Read on 7 September 2026. Source: [SOBA in Notion](https://app.notion.com/p/raineryesaya/SOBA-3d40560e43d880efbf68caca2589736d).

These notes record the page content in English. They are a structured translation and summary, not a verbatim export. Technical proposals are in [the technical design](SOBA-Technical-Design.md).

## Coverage

| Source area | Read result |
| --- | --- |
| Ideas Description | Full text and callout read |
| Latar Belakang Problem | Main problem and all four gaps read |
| The Product Itselt: SOBA | Both nested sections read |
| Soba Companion | All 7 feature rows read |
| Soba App: User | All 9 feature rows read |
| Soba App: Parent/Guardian | All 6 feature rows read |
| SOBA Flow | Full image read, including all six stages and three conversation modes |
| Branding image | Logo and tagline read |
| Expandable content | All 8 content toggles opened |
| Linked pages and databases | No child-page or database links found in the fully expanded page |
| Discussions | No open discussions shown. Resolved or private discussions were not confirmed |

The scope is all accessible content of the supplied page. This is not a claim of access to the entire Notion workspace or unpublished material. Two source images are included: [logo](assets/notion-logo.webp) and [flow](assets/notion-flow.webp).

## N1 — Idea and purpose

SOBA is a Voice AI emotional companion for young people who are not yet ready to speak to another person. It gives them a private place to speak naturally, express feelings, reflect, receive everyday emotional support, and use simple grounding or breathing activities.

SOBA is not an AI psychologist. It does not diagnose or replace professional help. Its purpose is to connect users to people when human help is more appropriate: a trusted person, guardian, counselor, professional, or crisis support. The connection must follow the user's needs and consent.

The stated journey is **LISTEN → SUPPORT → CONNECT**.

The logo says **“Speak Openly, Breathe Again.”** The flow image also uses **“A softer tomorrow, together.”** These are source taglines; no choice between them is specified.

## N2 — Problem and four gaps

The main problem is emotional distress among young people who are not ready, comfortable, or able to ask for help.

The page attributes two figures to I-NAMHS: about one in three Indonesian adolescents had a mental health problem in the past 12 months; about 2.6% used support or counseling services. The page provides no study link, population details, or denominator for the second figure. These are source claims, not independently verified research findings in this document.

1. **Expression gap.** Users can fear judgment, burdening others, or talking to family. They can feel their problem is too small, or not know how to start. A voice-first space removes the need to write a long message when tired, crying, panicked, or unable to type.
2. **Presence gap.** A text chatbot can feel like an ordinary application. Voice and a physical companion aim to create the feeling that someone is listening.
3. **Continuity gap.** Emotions change between formal support sessions. The page gives Monday stressed, Wednesday okay, and Sunday overwhelmed as an example. Voluntary check-ins and conversation history can show patterns without diagnosis.
4. **Human connection gap.** People can struggle repeatedly before contacting family, friends, a counselor, or professional support. The intended bridge is User → SOBA → Trusted Person / Guardian → Professional.

## N3 — Companion feature table

| ID | Source feature | Required behavior |
| --- | --- | --- |
| C1 | Real Time Voice Conversation | Speak directly with SOBA and receive a natural voice response |
| C2 | Emotionally Adaptive Response | Adjust speaking style to context; calm when overwhelmed, more cheerful when excited |
| C3 | Personalized Companion | Select personality and interaction preferences, including listening before advice |
| C4 | Conversation Memory | Remember important context across conversations only with user permission |
| C5 | Grounding Support | Guide breathing, grounding, or simple activities through voice |
| C6 | Safety Detection | Detect conversation signals that the user may need more help |
| C7 | Human Connection | Help connect to a trusted person or professional when needs exceed AI support |

## N4 — User app feature table

The app complements the physical companion. It supports use outside the home, emotion patterns, wellbeing tools, and human support. The same application contains the parent/guardian view.

| ID | Source feature | Required behavior |
| --- | --- | --- |
| U1 | My Soba | Pairing, companion status, and account settings |
| U2 | Mood Dashboard | Show mood from check-ins and companion conversations |
| U3 | Journal & Reflection | Show summaries or reflections from conversations the user chose to save |
| U4 | Mood & Pattern | Show emotion patterns over time |
| U5 | Wellbeing Toolkit | Revisit grounding, breathing, reflection, and activity resources |
| U6 | Circle of Trust | Manage trusted people whom SOBA can contact |
| U7 | Professional Support | Find and arrange access to professional help |
| U8 | Soba Personalization | Set personality, voice, and interaction preferences |
| U9 | Memory & Privacy | View and control SOBA memory and saved data |

## N5 — Parent/guardian app feature table

| ID | Source feature | Required behavior |
| --- | --- | --- |
| G1 | Wellbeing Pulse | Show a high-level condition, overall trend, and check-in count |
| G2 | Mood Trend | Show general mood patterns without conversation or journal content |
| G3 | Safety Alert | Notify a guardian when SOBA detects a serious safety concern |
| G4 | Reach Out | Let the guardian call or message the user |
| G5 | Parent Coach | Give guidance on how to respond to or approach the user |
| G6 | Safety & Connection Status | Show only permitted trusted contacts, safety plans, or professional referrals |

The feature table describes alerts generally. The flow qualifies notification with “if allowed.” Read both together: a serious signal does not give unrestricted permission to disclose data.

## N6 — Full flow image

### F1 — Setup and onboarding

1. Download SOBA App. The diagram specifies availability on **iOS and Android**.
2. Create an account. Choose User or Parent/Guardian role.
3. Set up the profile: basic information, privacy and consent, and optional emergency/trusted contact.
4. Pair SOBA Companion: scan a QR code or enter a device code.
5. Connect SOBA to home or mobile Wi-Fi.
6. Set personality, voice style, conversation preferences, memory settings, and privacy controls.
7. Optionally link a parent/guardian: send an invite code or QR, guardian creates an account, and user approves the connection.

### F2 — Everyday interaction

The user speaks naturally to the physical companion at home or on the go. The image calls the companion portable. It does not specify cellular hardware, offline AI, or a direct voice-chat screen in the app.

### F3 — AI processing and response

1. Understand voice: speech-to-text and context understanding.
2. Process with the SOBA AI system: use memory with consent, apply preferences, detect emotional state, and run a safety check.
3. Decide a personalized and emotionally adaptive response.
4. Speak the response through the companion.

The three outcomes are:

- **Normal Conversation:** casual conversation, emotional sharing, and everyday support.
- **Support Mode:** guided breathing, grounding, reflection, and reassurance.
- **Safety Mode:** detect serious concern, ask for clarification, offer human help, and notify a trusted person if allowed.

### F4 — Data and insights

1. Conversation ends.
2. Produce a structured summary containing mood/emotional state, main topic, reflection summary, key insights, and safety level.
3. Apply privacy and consent: save to journal, save to mood history, save as memory, or choose not to save.
4. Sync approved insights to the user's app dashboard.

### F5 — App views

The user view shows My Soba (including battery status), Mood Dashboard, Journal & Reflection, Wellbeing Toolkit, Circle of Trust, Personalization, and Memory & Privacy.

The guardian view shows Wellbeing Pulse, Mood Trend without private content, Safety Alert, Reach Out, Parent Coach, and Safety & Connection Status.

The text table additionally names Professional Support and a separate Mood & Pattern feature. Both remain in scope even though the image groups or omits them.

### F6 — Real support when needed

Connect to family, friends, or another trusted person; notify a guardian so they can reach out; or help find counselors and mental health professionals. The page does not define appointments, payments, emergency dispatch, a clinician portal, or delivery guarantees.

## Information not specified in Notion

No technology stack, API, schema, hosting service, board, battery, provider, budget, deadline, capacity target, retention period, exact age range, clinical decision threshold, notification channel, or operating team is specified. These need technical proposals or product decisions. Indonesian use is strongly suggested by the language, example, and context, but the launch language list is not explicit.
