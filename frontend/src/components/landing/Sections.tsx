import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpenText,
  Cpu,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  Mic,
  NotebookPen,
  PhoneCall,
  Shield,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserRoundCheck,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Card } from '../ui/Card'
import { ButtonLink } from '../ui/Button'
import { Reveal, SectionHeading } from '../ui/Brand'
import { CompanionMockup, PhoneMockup } from './Mockups'

/* ---------------------------------- Problem --------------------------------- */

const gaps = [
  {
    number: '01',
    title: 'Expression Gap',
    copy: 'Users may want to talk but do not know where to begin.',
  },
  {
    number: '02',
    title: 'Presence Gap',
    copy: 'Text interfaces can feel distant during emotional moments.',
  },
  {
    number: '03',
    title: 'Continuity Gap',
    copy: 'Emotional wellbeing changes over time, not just during appointments.',
  },
  {
    number: '04',
    title: 'Human Connection Gap',
    copy: 'The right human support often comes too late.',
  },
]

export function ProblemSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-soba">
        <Reveal>
          <SectionHeading
            eyebrow="The problem"
            title="When asking for help feels difficult."
            description="Most people do not go from struggling to seeking help in one step. Soba is built for the space in between."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {gaps.map((gap, index) => (
            <Reveal key={gap.number} delay={index * 80}>
              <Card
                interactive
                sheen
                padding="lg"
                className="h-full"
                tone={index % 3 === 0 ? 'cream' : 'surface'}
              >
                <span className="text-gradient-warm font-serif text-5xl leading-none">{gap.number}</span>
                <h3 className="mt-6 text-xl font-semibold tracking-headline text-brown-dark">{gap.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-secondary">{gap.copy}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Journey ---------------------------------- */

const journey: {
  key: string
  icon: LucideIcon
  title: string
  short: string
  detail: string
  points: string[]
}[] = [
  {
    key: 'listen',
    icon: Mic,
    title: 'Listen',
    short: 'Talk naturally through voice.',
    detail:
      'Soba starts by listening. No forms, no mood sliders, no pressure to explain yourself clearly. You can start mid-thought and it will follow.',
    points: ['Voice-first conversation', 'No scripts or questionnaires', 'Nothing saved unless you choose'],
  },
  {
    key: 'support',
    icon: Wind,
    title: 'Support',
    short: 'Reflect, ground, breathe, and understand emotional patterns.',
    detail:
      'Everyday support that fits the moment: a grounding exercise when things feel loud, a reflection when you want to make sense of the day, and patterns over time so nothing gets lost.',
    points: ['Grounding and breathing guidance', 'Reflections you control', 'Patterns, never diagnoses'],
  },
  {
    key: 'connect',
    icon: HeartHandshake,
    title: 'Connect',
    short: 'Reach trusted people or professional support when necessary.',
    detail:
      'Soba knows when it should not be the only support in the room. It helps you reach someone in your Circle of Trust, or find professional help, without taking that decision away from you.',
    points: ['Circle of Trust', 'Professional support directory', 'Guardian alerts without transcripts'],
  },
]

export function JourneySection() {
  const [active, setActive] = useState('listen')
  const current = journey.find((step) => step.key === active) ?? journey[0]

  return (
    <section className="bg-cream/70 py-20 lg:py-28">
      <div className="container-soba">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Core journey"
            title="Listen. Support. Connect."
            description="One continuous journey, designed so that support never stops at the conversation."
          />
        </Reveal>

        {/* Desktop: interactive horizontal journey */}
        <div className="mt-12 hidden lg:block">
          <div className="relative flex items-stretch justify-between gap-4">
            <div
              className="absolute left-[12%] right-[12%] top-[38px] h-px bg-brown/15"
              aria-hidden="true"
            />
            {journey.map((step, index) => {
              const isActive = step.key === active
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActive(step.key)}
                  aria-pressed={isActive}
                  className="relative flex flex-1 flex-col items-center px-4 text-center"
                >
                  <span
                    className={cn(
                      'flex h-[80px] w-[80px] items-center justify-center rounded-3xl border transition-all duration-300 ease-soba',
                      isActive
                        ? 'scale-105 border-apricot bg-gradient-to-br from-apricot-400 to-apricot text-white shadow-apricot-glow'
                        : 'border-line bg-surface text-brown shadow-card hover:-translate-y-1 hover:border-apricot-300 hover:shadow-soft',
                    )}
                  >
                    <step.icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    Step {index + 1}
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 font-serif text-2xl transition-colors',
                      isActive ? 'text-brown-dark' : 'text-brown/70',
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="mt-2 max-w-[240px] text-sm leading-relaxed text-ink-secondary">
                    {step.short}
                  </span>
                </button>
              )
            })}
          </div>

          <Card padding="lg" className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <h3 className="font-serif text-3xl text-brown-dark">{current.title}</h3>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
                {current.detail}
              </p>
            </div>
            <ul className="space-y-3 lg:border-l lg:border-line lg:pl-8">
              {current.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm text-brown-dark">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-apricot" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Mobile: vertical stepper */}
        <ol className="mt-12 space-y-4 lg:hidden">
          {journey.map((step, index) => (
            <Reveal as="li" key={step.key} delay={index * 80}>
              <Card padding="lg" className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-apricot text-white">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {index < journey.length - 1 ? (
                    <span className="mt-3 w-px flex-1 bg-line" aria-hidden="true" />
                  ) : null}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl text-brown-dark">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.detail}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* -------------------------------- Ecosystem --------------------------------- */

const companionFeatures = [
  'Real-time conversation',
  'Personalized interaction',
  'Grounding guidance',
  'Safety-aware conversation',
  'Human connection tools',
]

const appFeatures = [
  'Mood tracking',
  'Voice reflections',
  'Wellbeing toolkit',
  'Circle of Trust',
  'Guardian connection',
  'Professional support',
]

export function EcosystemSection() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-soba">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Ecosystem"
            title="One Soba. Wherever you need it."
            description="A physical companion for the moments at home, and an app that carries the rest of the journey."
          />
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <Card padding="lg" tone="cream" className="flex h-full flex-col">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brown text-cream">
                  <Cpu className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-headline text-brown-dark">Soba Companion</h3>
                  <p className="text-sm text-ink-secondary">Physical voice AI companion</p>
                </div>
              </div>

              <div className="my-8 flex justify-center">
                <CompanionMockup className="max-w-[220px]" />
              </div>

              <ul className="mt-auto space-y-2.5">
                {companionFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-brown-dark">
                    <span
                      className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-apricot/15"
                      aria-hidden="true"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-apricot" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={100}>
            <Card padding="lg" className="flex h-full flex-col">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-apricot text-white">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-headline text-brown-dark">Soba App</h3>
                  <p className="text-sm text-ink-secondary">Digital companion platform</p>
                </div>
              </div>

              <div className="my-8 flex justify-center">
                <PhoneMockup className="scale-95" />
              </div>

              <ul className="mt-auto grid gap-2.5 sm:grid-cols-2">
                {appFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-brown-dark">
                    <span
                      className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-apricot/15"
                      aria-hidden="true"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-apricot" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- Roles ------------------------------------ */

const roleFeatures = {
  user: [
    { icon: Mic, label: 'Talk to Soba' },
    { icon: NotebookPen, label: 'Review reflections' },
    { icon: TrendingUp, label: 'Understand patterns' },
    { icon: LockKeyhole, label: 'Manage privacy' },
    { icon: PhoneCall, label: 'Connect to support' },
  ],
  guardian: [
    { icon: Activity, label: 'Wellbeing Pulse' },
    { icon: TrendingUp, label: 'Mood Trend' },
    { icon: Bell, label: 'Safety Alerts' },
    { icon: MessageCircle, label: 'Reach Out' },
    { icon: BookOpenText, label: 'Parent Coach' },
  ],
}

export function RoleSection() {
  return (
    <section className="bg-cream/70 py-20 lg:py-28">
      <div className="container-soba">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <Card padding="lg" className="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-apricot">For you</p>
              <h3 className="mt-3 heading-serif text-[28px] leading-tight sm:text-[34px]">
                Your feelings. Your space. Your choice.
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-secondary">
                Everything you say belongs to you. Soba never shares your conversation with anyone
                unless you decide to.
              </p>
              <ul className="mt-7 space-y-3">
                {roleFeatures.user.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3 text-sm font-medium text-brown-dark">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-brown">
                      <feature.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={100}>
            <Card padding="lg" tone="brown" className="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-custard">
                For parents &amp; guardians
              </p>
              <h3 className="mt-3 heading-serif text-[28px] leading-tight text-cream sm:text-[34px]">
                Support without invading privacy.
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-cream/75">
                You see how they are doing and when to step closer. You do not see what they said.
              </p>
              <ul className="mt-7 space-y-3">
                {roleFeatures.guardian.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3 text-sm font-medium text-cream">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream/15 text-custard">
                      <feature.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={140}>
          <div className="grain relative mt-8 overflow-hidden rounded-[32px] border border-apricot/25 bg-gradient-to-br from-apricot-100 via-apricot-50 to-cream px-6 py-12 text-center sm:px-10">
            <p className="heading-serif text-[28px] leading-snug sm:text-[38px]">
              Share the risk, not the private story.
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">
              Guardians receive wellbeing patterns and safety signals. Conversations, journals, and
              transcripts stay with the person who wrote them.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------- Safety ----------------------------------- */

const limits = [
  { icon: Shield, title: 'Does not diagnose', copy: 'Soba describes patterns. It never labels a condition.' },
  { icon: LockKeyhole, title: 'Does not prescribe', copy: 'No treatment plans, no medication guidance, ever.' },
  {
    icon: UserRoundCheck,
    title: 'Does not replace professionals',
    copy: 'Soba is a first step, not the destination.',
  },
  {
    icon: HeartHandshake,
    title: 'Prioritizes human connection',
    copy: 'Serious concerns route toward people, not more AI.',
  },
]

export function SafetySection() {
  return (
    <section className="mesh-deep grain relative overflow-hidden bg-gradient-to-b from-brown-700 to-brown-900 py-20 text-cream lg:py-28">
      <div className="container-soba relative">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <Reveal>
            <SectionHeading
              tone="light"
              eyebrow="Safety"
              title="AI should know its limits."
              description="Soba is built around the moments where continuing with AI alone would be the wrong answer."
            />
            <div className="mt-8">
              <ButtonLink to="/safety" variant="secondary" size="lg">
                Learn about Soba Safety
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {limits.map((limit, index) => (
              <Reveal key={limit.title} delay={index * 80}>
                <div className="h-full rounded-3xl border border-cream/15 bg-cream/[0.06] p-6 backdrop-blur-sm transition-all duration-300 ease-soba hover:-translate-y-1 hover:border-custard/30 hover:bg-cream/[0.10]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream/[0.12] text-custard">
                    <limit.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-cream">{limit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/70">{limit.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={140}>
          <p className="relative mt-16 border-t border-cream/15 pt-10 text-center font-serif text-[26px] leading-snug text-custard sm:text-[34px]">
            <span
              className="absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-apricot to-transparent"
              aria-hidden="true"
            />
            Some conversations should lead to a human.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* -------------------------------- Final CTA --------------------------------- */

export function FinalCTA() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container-soba">
        <Reveal>
          <div className="mesh-warm grain relative overflow-hidden rounded-[36px] border border-custard/60 bg-cream px-6 py-16 text-center sm:px-12 lg:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-custard/50 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-apricot/15 blur-3xl"
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="heading-serif text-[34px] leading-[1.12] sm:text-[46px]">
                You don&rsquo;t have to know exactly what to say.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-secondary sm:text-lg">
                Start where you are. Soba will meet you there, and help you reach further when you
                are ready.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink to="/signup" size="lg">
                  Start with Soba
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </ButtonLink>
                <ButtonLink to="/about" variant="outline" size="lg">
                  Learn More
                </ButtonLink>
              </div>
              <p className="mt-8 inline-flex items-center gap-2 text-sm text-ink-muted">
                <ShieldCheck className="h-4 w-4 text-sage" aria-hidden="true" />
                Private by default. You choose what is remembered.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------- Shared bits -------------------------------- */

export function FeatureGrid({
  items,
}: {
  items: { icon: LucideIcon; title: string; copy: string }[]
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <Reveal key={item.title} delay={index * 60}>
          <Card interactive sheen padding="lg" className="group h-full">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset transition-all duration-300 ease-soba group-hover:from-apricot-400 group-hover:to-apricot group-hover:text-white group-hover:shadow-apricot-glow">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-headline text-brown-dark">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.copy}</p>
          </Card>
        </Reveal>
      ))}
    </div>
  )
}

