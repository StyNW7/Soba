import { ArrowRight, HeartHandshake, Mic, ShieldCheck, Users } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { Reveal } from '../ui/Brand'
import { PhoneMockup, StatusChip } from './Mockups'
import { SobaBear } from '../ui/SobaBear'

export function Hero() {
  return (
    <section className="mesh-warm grain relative overflow-hidden pb-20 pt-10 sm:pt-14 lg:pb-28 lg:pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-cream/70 blur-3xl" />
        <div className="absolute -right-32 top-16 h-[460px] w-[460px] rounded-full bg-custard/35 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-[340px] w-[340px] rounded-full bg-apricot-soft/45 blur-3xl" />
      </div>

      <div className="container-soba relative">
        <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-line/80 bg-surface/70 py-1.5 pl-2 pr-4 text-xs font-medium text-brown shadow-card backdrop-blur">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-apricot/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-apricot" aria-hidden="true" />
                </span>
                Listen. Support. Connect.
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-7 heading-serif text-[44px] leading-[1.04] sm:text-[58px] lg:text-[68px]">
                Someone to talk to,
                <br />
                <span className="relative inline-block text-apricot">
                  when words feel difficult.
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 420 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-2.5 w-full text-custard"
                  >
                    <path
                      d="M2 8C90 3 200 2 418 6"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </span>
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
                Soba is a voice-first emotional companion that listens without judgment, supports
                everyday wellbeing, and helps you connect with the people who matter when you need
                them.
              </p>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/signup" size="lg" className="group sm:w-auto">
                  Meet Soba
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </ButtonLink>
                <ButtonLink to="/how-it-works" variant="secondary" size="lg">
                  See How It Works
                </ButtonLink>
              </div>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-line/70 pt-6">
                <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
                  <ShieldCheck className="h-4 w-4 text-sage" aria-hidden="true" />
                  Designed for support, not diagnosis.
                </p>
                <p className="inline-flex items-center gap-2 text-sm text-ink-muted">
                  <Mic className="h-4 w-4 text-brown-soft" aria-hidden="true" />
                  Nothing saved unless you choose.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={160} className="relative">
            <div className="relative mx-auto flex max-w-[520px] items-center justify-center">
              {/* Soft plinth behind the composition */}
              <div
                aria-hidden="true"
                className="absolute inset-x-6 bottom-2 top-10 rounded-[46%_46%_38%_38%/40%_40%_22%_22%] bg-gradient-to-b from-white/50 to-transparent blur-2xl"
              />
              <SobaBear pose="welcome" className="relative w-full max-w-[460px]" />
              <PhoneMockup className="absolute -bottom-10 -left-2 hidden scale-[0.86] sm:block lg:-left-12 lg:scale-95" />
              <StatusChip
                icon={Mic}
                title="Listening"
                subtitle="Nothing saved unless you choose"
                className="absolute -top-1 right-0 hidden sm:flex lg:-right-8"
              />
              <StatusChip
                icon={HeartHandshake}
                title="Maria is in your circle"
                subtitle="One tap to reach her"
                className="absolute bottom-8 right-0 hidden lg:flex"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const values = [
  { icon: ShieldCheck, title: 'Private by Design', copy: 'Your conversations stay yours by default.' },
  { icon: Mic, title: 'Voice First', copy: 'Speak naturally. No forms, no scripts.' },
  { icon: Users, title: 'Human Connected', copy: 'Built to bring people closer, not replace them.' },
  { icon: HeartHandshake, title: 'Safety Guided', copy: 'Serious moments route toward real support.' },
]

export function TrustStrip() {
  return (
    <section className="border-y border-line bg-surface/70">
      <div className="container-soba grid divide-y divide-line/70 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        {values.map((value, index) => (
          <Reveal
            key={value.title}
            delay={index * 70}
            className="flex items-start gap-3.5 py-7 sm:px-6 lg:px-7 lg:py-10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-brown">
              <value.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brown-dark">{value.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{value.copy}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
