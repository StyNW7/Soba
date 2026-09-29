import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  BellRing,
  BookOpenText,
  Check,
  Download,
  Eye,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  Mic,
  NotebookPen,
  PhoneCall,
  Plus,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserPlus,
  UserRoundCheck,
  Users,
  Wind,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ButtonLink } from '../ui/Button'
import { Reveal, SectionHeading } from '../ui/Brand'
import { SobaBear } from '../ui/SobaBear'
import { AlertCard } from '../ui/Feedback'

/* Sticky navbar is 72px; keep anchored headings clear of it. */
const anchor = 'scroll-mt-[72px]'

/* ---------------------------------- About ----------------------------------- */

const pillars: { icon: LucideIcon; title: string; copy: string }[] = [
  {
    icon: Mic,
    title: 'Listen',
    copy: 'Talk naturally by voice. No forms, no scripts, no pressure to explain perfectly.',
  },
  {
    icon: Wind,
    title: 'Support',
    copy: 'Grounding, breathing and gentle reflections that fit the moment you are in.',
  },
  {
    icon: HeartHandshake,
    title: 'Connect',
    copy: 'Reach someone you trust, or a professional, when talking to AI is not enough.',
  },
]

export function AboutSection() {
  return (
    <section id="about" className={cn(anchor, 'py-20 lg:py-28')}>
      <div className="container-soba">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <Reveal className="relative order-2 lg:order-1">
            <div className="relative mx-auto max-w-[480px]">
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-[48px] bg-gradient-to-br from-custard/40 via-cream to-apricot-100 blur-2xl"
              />
              <div className="grain relative aspect-[4/5] overflow-hidden rounded-[40px] rounded-tl-[110px] border border-custard/60 bg-gradient-to-b from-cream-tint via-cream to-apricot-100 shadow-float">
                <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-50" />
                <div
                  aria-hidden="true"
                  className="absolute left-1/2 top-[16%] aspect-square w-[78%] -translate-x-1/2 rounded-full bg-gradient-to-b from-custard/70 via-custard-soft/40 to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="absolute bottom-[8%] left-1/2 h-[9%] w-[64%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-apricot-200 to-apricot-100 shadow-[inset_0_2px_6px_rgba(255,255,255,0.7)]"
                />

                <div className="absolute bottom-[12%] left-1/2 w-[50%] -translate-x-1/2">
                  <SobaBear pose="love" className="w-full animate-float" />
                </div>

                <div className="absolute left-[7%] top-[8%] max-w-[58%] animate-float rounded-2xl rounded-bl-md border border-line/70 bg-surface/95 px-3.5 py-2.5 shadow-lift [animation-delay:-2s] sm:px-4 sm:py-3">
                  <p className="text-[11px] font-semibold leading-snug text-brown-dark sm:text-[13px]">
                    I&rsquo;m here. Take your time.
                  </p>
                  <span className="mt-1.5 flex items-end gap-[3px]" aria-hidden="true">
                    {[6, 10, 7, 12, 8].map((h, i) => (
                      <span
                        key={i}
                        className="w-[3px] rounded-full bg-apricot/70"
                        style={{ height: h }}
                      />
                    ))}
                  </span>
                </div>

                {(
                  [
                    { pose: 'happy', pos: 'right-[7%] top-[13%]', delay: '-1s' },
                    { pose: 'wink', pos: 'left-[6%] top-[46%]', delay: '-3.5s' },
                    { pose: 'cute', pos: 'right-[6%] top-[50%]', delay: '-5s' },
                  ] as const
                ).map((face) => (
                  <span
                    key={face.pose}
                    aria-hidden="true"
                    className={cn(
                      'absolute flex h-[13%] w-auto animate-float items-center justify-center rounded-full border border-line/70 bg-surface p-[1.6%] shadow-soft',
                      face.pos,
                    )}
                    style={{ aspectRatio: '1', animationDelay: face.delay }}
                  >
                    <SobaBear pose={face.pose} className="w-full" />
                  </span>
                ))}

                <Sparkles
                  aria-hidden="true"
                  className="absolute right-[24%] top-[33%] h-5 w-5 animate-float text-custard-deep [animation-delay:-1.5s]"
                />
              </div>

              <div className="absolute -bottom-6 -right-2 flex animate-float items-center gap-3 rounded-2xl border border-line/80 bg-surface/95 px-4 py-3 shadow-lift backdrop-blur-md sm:-right-8">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-apricot-400 to-apricot text-white shadow-apricot-glow">
                  <Mic className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-brown-dark">Always ready to listen</p>
                  <p className="text-[11px] text-ink-muted">Voice-first, judgment-free</p>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="order-1 lg:order-2">
            <Reveal>
              <SectionHeading
                eyebrow="What is Soba"
                title="A companion for the moment before someone asks for help."
              />
            </Reveal>
            <Reveal delay={80}>
              <p className="mt-5 text-base leading-relaxed text-ink-secondary sm:text-[17px]">
                Most people don&rsquo;t go straight from struggling to seeking support. Soba is a
                voice-first companion for that quiet stretch in between: it listens without
                judgment, helps you feel steadier, and points you toward real people when it
                matters.
              </p>
            </Reveal>

            <ul className="mt-9 space-y-3">
              {pillars.map((pillar, index) => (
                <Reveal as="li" key={pillar.title} delay={120 + index * 70}>
                  <div className="group flex items-start gap-4 rounded-3xl border border-line bg-surface p-4 shadow-card transition-all duration-300 ease-soba hover:-translate-y-0.5 hover:border-apricot-200 hover:shadow-soft sm:p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset transition-all duration-300 ease-soba group-hover:from-apricot-400 group-hover:to-apricot group-hover:text-white">
                      <pillar.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-brown-dark">{pillar.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                        {pillar.copy}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- How it works ------------------------------- */

const steps: { icon: LucideIcon; title: string; copy: string }[] = [
  {
    icon: UserPlus,
    title: 'Set up in minutes',
    copy: 'Create an account, choose who Soba is for, and decide what it may remember.',
  },
  {
    icon: Mic,
    title: 'Talk when you want',
    copy: 'Open a session and speak. No prompts to answer, no minimum length.',
  },
  {
    icon: NotebookPen,
    title: 'Keep what you choose',
    copy: 'Soba prepares a short reflection. Nothing is saved until you approve it.',
  },
  {
    icon: UserRoundCheck,
    title: 'Reach a person',
    copy: 'When something serious comes up, Soba helps you contact someone who can help.',
  },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className={cn(anchor, 'relative overflow-hidden bg-cream/70 py-20 lg:py-28')}
    >
      <div className="container-soba">
        <div className="flex flex-col items-center gap-6 text-center">
          <Reveal>
            <SobaBear pose="working" className="mx-auto w-20 sm:w-24" />
          </Reveal>
          <Reveal delay={60}>
            <SectionHeading
              align="center"
              eyebrow="How it works"
              title="Four simple steps. No clinical intake."
              description="From a first sentence to the right kind of support, at your own pace."
            />
          </Reveal>
        </div>

        <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-7 hidden border-t-2 border-dashed border-apricot-300/70 lg:block"
          />
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 90} className="relative">
              <div className="flex h-full flex-col items-center text-center">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-apricot-400 to-apricot text-white shadow-apricot-glow ring-8 ring-cream">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="mt-5 flex h-full w-full flex-col items-center rounded-3xl border border-line bg-surface p-6 shadow-card">
                  <span className="text-xs font-semibold uppercase tracking-eyebrow text-apricot-700">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-brown-dark">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={200}>
          <p className="mx-auto mt-10 flex w-fit max-w-full items-start gap-2 rounded-2xl border border-sage/20 bg-sage-soft/80 px-4 py-3 text-sm leading-relaxed text-sage-deep">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Raw audio storage is off by default and stays off unless you turn it on.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------- Features --------------------------------- */

type Audience = 'you' | 'guardian'

const features: Record<Audience, { icon: LucideIcon; title: string; copy: string }[]> = {
  you: [
    { icon: Mic, title: 'Talk to Soba', copy: 'A voice conversation that starts wherever you are.' },
    {
      icon: TrendingUp,
      title: 'Mood patterns',
      copy: 'Trends from your own check-ins. Patterns, never diagnoses.',
    },
    {
      icon: NotebookPen,
      title: 'Journal & reflections',
      copy: 'Short summaries you choose to keep, visible only to you.',
    },
    {
      icon: Wind,
      title: 'Wellbeing toolkit',
      copy: 'Grounding, breathing and wind-down sessions in one tap.',
    },
    {
      icon: Users,
      title: 'Circle of Trust',
      copy: 'The people Soba can help you reach, with permissions you set.',
    },
    {
      icon: LockKeyhole,
      title: 'Memory & privacy',
      copy: 'See, edit, export or delete everything Soba remembers.',
    },
  ],
  guardian: [
    {
      icon: Activity,
      title: 'Wellbeing pulse',
      copy: 'How the week has gone, without a single line of conversation.',
    },
    {
      icon: TrendingUp,
      title: 'Mood trends',
      copy: 'Direction over time, shared only while consent is active.',
    },
    {
      icon: BellRing,
      title: 'Safety alerts',
      copy: 'A clear signal when a check-in is recommended, with next steps.',
    },
    {
      icon: MessageCircle,
      title: 'Reach out',
      copy: 'Call or message, with a gentle opener when you don’t know how to start.',
    },
    {
      icon: BookOpenText,
      title: 'Parent coach',
      copy: 'Short guides on listening and supporting without intruding.',
    },
    {
      icon: Stethoscope,
      title: 'Professional pathways',
      copy: 'Reviewed support resources, so escalation has somewhere to go.',
    },
  ],
}

const audiences: { key: Audience; label: string; short: string }[] = [
  { key: 'you', label: 'For you', short: 'For you' },
  { key: 'guardian', label: 'For parents & guardians', short: 'For guardians' },
]

export function FeaturesSection() {
  const [audience, setAudience] = useState<Audience>('you')

  return (
    <section id="features" className={cn(anchor, 'py-20 lg:py-28')}>
      <div className="container-soba">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Features"
            title="Everything you need. Nothing you don’t."
            description="Two experiences built on the same journey: one for the person doing the feeling, one for the person trying to help."
          />
        </Reveal>

        <Reveal delay={80}>
          <div
            role="tablist"
            aria-label="Choose who the features are for"
            className="mx-auto mt-10 flex w-fit max-w-full rounded-2xl border border-line bg-muted p-1.5 shadow-inset"
          >
            {audiences.map((item) => {
              const active = item.key === audience
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`tab-${item.key}`}
                  aria-selected={active}
                  aria-controls="features-panel"
                  onClick={() => setAudience(item.key)}
                  className={cn(
                    'whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ease-soba sm:px-6',
                    active
                      ? 'bg-surface text-brown-dark shadow-soft'
                      : 'text-ink-secondary hover:text-brown-dark',
                  )}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              )
            })}
          </div>
        </Reveal>

        <div
          id="features-panel"
          role="tabpanel"
          aria-labelledby={`tab-${audience}`}
          className="mt-10"
        >
          <ul key={audience} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {features[audience].map((feature, index) => (
              <li
                key={feature.title}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="sheen group flex h-full items-start gap-4 rounded-3xl border border-line bg-surface p-6 shadow-card transition-all duration-300 ease-soba hover:-translate-y-1 hover:border-apricot-200 hover:shadow-lift">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset transition-all duration-300 ease-soba group-hover:from-apricot-400 group-hover:to-apricot group-hover:text-white group-hover:shadow-apricot-glow">
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-brown-dark">{feature.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                      {feature.copy}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div
            key={`${audience}-note`}
            className="grain relative mt-6 flex animate-fade-up flex-col items-center gap-5 overflow-hidden rounded-[32px] border border-apricot/25 bg-gradient-to-br from-apricot-100 via-apricot-50 to-cream px-6 py-8 text-center sm:flex-row sm:px-10 sm:text-left"
            style={{ animationDelay: '300ms' }}
          >
            <SobaBear
              pose={audience === 'you' ? 'excited' : 'reading'}
              className="w-20 shrink-0 sm:w-24"
            />
            <div className="min-w-0">
              <p className="heading-serif text-[24px] leading-snug sm:text-[30px]">
                {audience === 'you'
                  ? 'Your feelings. Your space. Your choice.'
                  : 'Share the risk, not the private story.'}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
                {audience === 'you'
                  ? 'Everything you say belongs to you. Soba never shares your conversations unless you decide to.'
                  : 'Guardians see wellbeing patterns and safety signals. Conversations, journals and transcripts stay private.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- Safety ---------------------------------- */

const limits: { icon: LucideIcon; title: string; copy: string }[] = [
  { icon: Scale, title: 'Does not diagnose', copy: 'Soba describes patterns, never conditions.' },
  { icon: Shield, title: 'Does not prescribe', copy: 'No treatment plans or medication advice.' },
  {
    icon: UserRoundCheck,
    title: 'Does not replace professionals',
    copy: 'A first step, not the destination.',
  },
  {
    icon: HeartHandshake,
    title: 'Routes serious concerns',
    copy: 'Real risk moves toward people, not more AI.',
  },
]

const sharing = [
  { shared: true, label: 'Wellbeing pulse & mood direction' },
  { shared: true, label: 'Safety alerts (no content attached)' },
  { shared: false, label: 'Conversation transcripts' },
  { shared: false, label: 'Journal entries' },
  { shared: false, label: 'Saved memories' },
]

const dataRights: { icon: LucideIcon; label: string }[] = [
  { icon: Eye, label: 'See everything' },
  { icon: Download, label: 'Export anytime' },
  { icon: Trash2, label: 'Delete in one screen' },
  { icon: LockKeyhole, label: 'Private by default' },
]

export function SafetySection() {
  return (
    <section
      id="safety"
      className={cn(
        anchor,
        'mesh-deep grain relative overflow-hidden bg-gradient-to-b from-brown-700 to-brown-900 py-20 text-cream lg:py-28',
      )}
    >
      <div className="container-soba relative">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionHeading
                tone="light"
                eyebrow="Safety & privacy"
                title="AI should know its limits."
                description="Soba is built around the moments where continuing with AI alone would be the wrong answer."
              />
            </Reveal>

            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {limits.map((limit, index) => (
                <Reveal as="li" key={limit.title} delay={index * 70}>
                  <div className="h-full rounded-3xl border border-cream/15 bg-cream/[0.06] p-5 backdrop-blur-sm transition-all duration-300 ease-soba hover:-translate-y-0.5 hover:border-custard/30 hover:bg-cream/[0.10]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cream/[0.12] text-custard">
                      <limit.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-[15px] font-semibold text-cream">{limit.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-cream/70">{limit.copy}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal delay={120} className="flex flex-col">
            <div className="rounded-[32px] border border-cream/15 bg-cream/[0.07] p-5 min-[380px]:p-6 backdrop-blur-sm sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-custard">
                What a guardian can see
              </p>
              <ul className="mt-5 divide-y divide-cream/10">
                {sharing.map((item) => (
                  <li key={item.label} className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        item.shared ? 'bg-sage/30 text-[#cfe0c4]' : 'bg-cream/10 text-cream/60',
                      )}
                    >
                      {item.shared ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <X className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 text-sm',
                        item.shared ? 'text-cream' : 'text-cream/70',
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium',
                        item.shared ? 'bg-sage/25 text-[#cfe0c4]' : 'bg-cream/10 text-cream/60',
                      )}
                    >
                      {item.shared ? 'With consent' : 'Never'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 grid gap-3 min-[380px]:grid-cols-2">
              {dataRights.map((right) => (
                <li
                  key={right.label}
                  className="flex items-center gap-2.5 rounded-2xl border border-cream/10 bg-cream/[0.05] px-4 py-3 text-sm text-cream/85"
                >
                  <right.icon className="h-4 w-4 shrink-0 text-custard" aria-hidden="true" />
                  {right.label}
                </li>
              ))}
            </ul>
          </Reveal>
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

/* --------------------------------- Support ---------------------------------- */

const pathways: { icon: LucideIcon; title: string; copy: string }[] = [
  {
    icon: Users,
    title: 'Someone you trust',
    copy: 'Your Circle of Trust is usually the best first route. Soba helps you reach them.',
  },
  {
    icon: Stethoscope,
    title: 'A professional',
    copy: 'Psychologists and counsellors, filtered by language, location and online availability.',
  },
  {
    icon: PhoneCall,
    title: 'Crisis support',
    copy: 'When it is urgent, Soba points to services staffed by people, not more AI.',
  },
]

const faqs = [
  {
    q: 'Does Soba replace therapy?',
    a: 'No. Soba is an emotional support companion for everyday moments. It does not diagnose, treat, or replace a licensed professional.',
  },
  {
    q: 'Can my parent read my conversations?',
    a: 'No. Transcripts and journal entries are never shared with a guardian by default. Guardians see wellbeing patterns and safety alerts only.',
  },
  {
    q: 'What happens if I say something serious?',
    a: 'Soba moves into a safety-focused mode, offers to help you reach someone you trust or a professional, and can let a guardian know a check-in is recommended without sharing what you said.',
  },
  {
    q: 'Do I need the Soba Companion device?',
    a: 'No. The app works fully on its own. The plush companion is an optional way to talk to Soba at home.',
  },
]

export function SupportSection() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="support" className={cn(anchor, 'py-20 lg:py-28')}>
      <div className="container-soba">
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Support"
            title="You never have to go through it alone."
            description="Soba is built to hand things over well. Here is where those handovers go."
          />
        </Reveal>

        <ul className="mt-12 grid gap-4 md:grid-cols-3 lg:gap-5">
          {pathways.map((pathway, index) => (
            <Reveal as="li" key={pathway.title} delay={index * 80}>
              <div className="h-full rounded-3xl border border-line bg-surface p-6 shadow-card transition-all duration-300 ease-soba hover:-translate-y-1 hover:border-apricot-200 hover:shadow-lift sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset">
                    <pathway.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-3xl leading-none text-apricot-300">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-brown-dark">{pathway.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{pathway.copy}</p>
              </div>
            </Reveal>
          ))}
        </ul>

        <div className="mt-16 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <Reveal>
            <h3 className="heading-serif text-[30px] leading-tight sm:text-[36px]">
              Questions people ask first.
            </h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-secondary">
              Short answers to the things that matter most before you start.
            </p>
            <AlertCard tone="urgent" icon={Shield} title="Soba is not an emergency service" className="mt-8">
              If you or someone else is in immediate danger, contact local emergency services. In
              Indonesia, call 112, or reach the SEJIWA line on 119 extension 8.
            </AlertCard>
          </Reveal>

          <Reveal delay={100}>
            <ul className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = open === index
                return (
                  <li
                    key={faq.q}
                    className={cn(
                      'overflow-hidden rounded-3xl border bg-surface shadow-card transition-colors duration-300',
                      isOpen ? 'border-apricot-200' : 'border-line',
                    )}
                  >
                    <h4>
                      <button
                        type="button"
                        id={`faq-q-${index}`}
                        aria-expanded={isOpen}
                        aria-controls={`faq-a-${index}`}
                        onClick={() => setOpen(isOpen ? null : index)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-brown-dark sm:px-6 sm:py-5"
                      >
                        {faq.q}
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-soba',
                            isOpen ? 'rotate-45 bg-apricot text-white' : 'bg-cream text-brown',
                          )}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </button>
                    </h4>
                    <div
                      id={`faq-a-${index}`}
                      role="region"
                      aria-labelledby={`faq-q-${index}`}
                      className={cn(
                        'grid transition-all duration-300 ease-soba',
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <div className="overflow-hidden" inert={!isOpen}>
                        <p className="px-5 pb-5 text-sm leading-relaxed text-ink-secondary sm:px-6">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- Final CTA --------------------------------- */

export function FinalCTA() {
  return (
    <section className="pb-20 lg:pb-28">
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
              <SobaBear pose="wave" className="mx-auto mb-6 w-20 sm:w-24" />
              <h2 className="heading-serif text-[34px] leading-[1.12] sm:text-[46px]">
                You don&rsquo;t have to know exactly what to say.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-ink-secondary sm:text-lg">
                Start where you are. Soba will meet you there, and help you reach further when you
                are ready.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink to="/signup" size="lg" className="group">
                  Get Started
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </ButtonLink>
                <ButtonLink to="/login" variant="outline" size="lg">
                  I already have an account
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
