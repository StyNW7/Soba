import { CheckCircle2, Cpu, MessagesSquare, NotebookPen, ShieldCheck, UserRoundCheck } from 'lucide-react'
import { PageHero } from '../../components/landing/PageHero'
import { FinalCTA, JourneySection } from '../../components/landing/Sections'
import { Card } from '../../components/ui/Card'
import { Reveal, SectionHeading } from '../../components/ui/Brand'
import { PhoneMockup } from '../../components/landing/Mockups'

const steps = [
  {
    icon: Cpu,
    title: 'Set up in a few minutes',
    copy: 'Create an account, choose whether you are here for yourself or supporting someone, and decide what Soba may remember. Pairing a companion device is optional.',
  },
  {
    icon: MessagesSquare,
    title: 'Talk when you want to',
    copy: 'Open a session and speak. There are no prompts you have to answer and no minimum length. Soba follows your pace.',
  },
  {
    icon: NotebookPen,
    title: 'Keep only what you choose',
    copy: 'After a conversation Soba prepares a short reflection. Nothing is saved until you review it and decide to keep it.',
  },
  {
    icon: UserRoundCheck,
    title: 'Reach a person when it matters',
    copy: 'When something serious comes up, Soba helps you contact someone in your Circle of Trust or find professional support.',
  },
]

const dataFlow = [
  { label: 'You speak', detail: 'Audio is processed to understand what you said.' },
  { label: 'Soba responds', detail: 'A warm, non-clinical reply, shaped by your stated preference.' },
  { label: 'You decide', detail: 'Reflection, mood, and memory are each saved only if you say so.' },
  { label: 'Patterns form', detail: 'Over time, your own words become a picture of how things have been.' },
]

export default function HowItWorks() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From a first sentence to the right kind of support."
        description="Soba is built around one journey. Everything else in the product exists to serve it."
      />

      <JourneySection />

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Getting started" title="Four steps, no clinical intake." />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {steps.map((step, index) => (
              <Reveal key={step.title} delay={index * 80}>
                <Card padding="lg" interactive className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-brown">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-brown-dark">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.copy}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <SectionHeading
              eyebrow="What happens to what you say"
              title="You stay in control of every step."
              description="Soba is deliberately unremarkable about your data: it does as little as possible with it, and asks before doing more."
            />
            <ul className="mt-8 space-y-4">
              {dataFlow.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-apricot" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-brown-dark">{item.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-secondary">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-8 inline-flex items-start gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-sm leading-relaxed text-[#4A5C40]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Raw audio storage is off by default and stays off unless you deliberately enable it.
            </p>
          </Reveal>

          <Reveal delay={120} className="flex justify-center">
            <PhoneMockup />
          </Reveal>
        </div>
      </section>

      <FinalCTA />
    </>
  )
}
