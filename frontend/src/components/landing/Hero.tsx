import { ArrowRight, HeartHandshake, Mic, ShieldCheck, Users } from 'lucide-react'
import { ButtonLink } from '../ui/Button'
import { Reveal } from '../ui/Brand'
import { CompanionMockup, PhoneMockup, StatusChip } from './Mockups'

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-12 sm:pt-16 lg:pb-28 lg:pt-20">
      {/* Warm ambient shapes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-cream blur-3xl opacity-70" />
        <div className="absolute -right-24 top-24 h-[420px] w-[420px] rounded-full bg-custard/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-apricot-soft/50 blur-3xl" />
      </div>

      <div className="container-soba relative">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-brown backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-apricot" aria-hidden="true" />
              Listen. Support. Connect.
            </span>

            <h1 className="mt-6 heading-serif text-[42px] leading-[1.08] sm:text-[56px] lg:text-[64px]">
              Someone to talk to,
              <br />
              <span className="text-apricot">when words feel difficult.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-secondary sm:text-lg">
              Soba is a voice-first emotional companion that listens without judgment, supports
              everyday wellbeing, and helps you connect with the people who matter when you need
              them.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/signup" size="lg" className="sm:w-auto">
                Meet Soba
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/how-it-works" variant="secondary" size="lg">
                See How It Works
              </ButtonLink>
            </div>

            <p className="mt-7 inline-flex items-center gap-2 text-sm text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-sage" aria-hidden="true" />
              Designed for support, not diagnosis.
            </p>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="relative mx-auto flex max-w-[520px] items-center justify-center">
              <CompanionMockup className="translate-x-2 sm:translate-x-6" />
              <PhoneMockup className="absolute -bottom-8 -left-2 hidden scale-[0.86] sm:block lg:-left-10 lg:scale-95" />
              <StatusChip
                icon={Mic}
                title="Listening"
                subtitle="Nothing saved unless you choose"
                className="absolute -top-2 right-0 hidden animate-fade-up sm:flex lg:-right-6"
              />
              <StatusChip
                icon={HeartHandshake}
                title="Maria is in your circle"
                subtitle="One tap to reach her"
                className="absolute bottom-6 right-0 hidden animate-fade-up lg:flex"
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
      <div className="container-soba grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:py-12">
        {values.map((value, index) => (
          <Reveal key={value.title} delay={index * 70} className="flex items-start gap-3.5">
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
