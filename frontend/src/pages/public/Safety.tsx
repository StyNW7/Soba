import { Ban, Database, Download, Eye, HeartHandshake, LockKeyhole, Shield, Trash2 } from 'lucide-react'
import { PageHero } from '../../components/landing/PageHero'
import { FinalCTA, SafetySection } from '../../components/landing/Sections'
import { Card } from '../../components/ui/Card'
import { Reveal, SectionHeading } from '../../components/ui/Brand'
import { AlertCard } from '../../components/ui/Feedback'

const boundaries = [
  { title: 'Soba does not diagnose', copy: 'It will never tell you that you have a condition, and it will never imply one.' },
  { title: 'Soba does not prescribe', copy: 'No treatment plans, no medication advice, no clinical instructions.' },
  { title: 'Soba does not replace professionals', copy: 'It is a first step and a companion between real conversations.' },
  { title: 'Soba does not encourage dependency', copy: 'It actively points back toward people in your life.' },
  { title: 'Soba prioritizes human connection', copy: 'Reaching someone is presented as the better option, not the fallback.' },
  { title: 'Soba routes serious concerns', copy: 'Signals of real risk move the conversation toward safer support flows.' },
]

const dataRights = [
  { icon: Eye, title: 'See everything', copy: 'Every saved reflection, mood entry, and memory is visible and editable.' },
  { icon: Download, title: 'Export it', copy: 'Take a full copy of your data at any time in a portable format.' },
  { icon: Trash2, title: 'Delete it', copy: 'Deletion is reachable in one screen, not buried in settings.' },
  { icon: Database, title: 'Limit what is kept', copy: 'Transcripts and raw audio are off by default and stay off unless enabled.' },
]

const sharingRules = [
  {
    shared: true,
    label: 'Wellbeing pulse and mood direction',
    detail: 'A high-level view of how the week has felt.',
  },
  { shared: true, label: 'Safety alerts', detail: 'A signal that a check-in is recommended, with no content attached.' },
  { shared: false, label: 'Conversation transcripts', detail: 'Never shared with a guardian by default.' },
  { shared: false, label: 'Journal entries', detail: 'Private reflections stay with the person who wrote them.' },
  { shared: false, label: 'Saved memories', detail: 'Context Soba holds for you is yours alone.' },
]

export default function Safety() {
  return (
    <>
      <PageHero
        eyebrow="Safety & Privacy"
        title="AI should know its limits."
        description="Soba is designed around the assumption that the most important thing it can do is recognise when it should not be the one helping."
      />

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Boundaries" title="What Soba will never do." />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {boundaries.map((item, index) => (
              <Reveal key={item.title} delay={index * 60}>
                <Card padding="lg" className="h-full">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta-soft text-terracotta-dark">
                    <Ban className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-brown-dark">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{item.copy}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <SectionHeading
              eyebrow="Sharing"
              title="Share the risk, not the private story."
              description="Guardians exist in Soba to be reachable, not to observe. The boundary below is the product, not a setting we hope people find."
            />
          </Reveal>
          <Reveal delay={100}>
            <Card padding="lg">
              <ul className="divide-y divide-line">
                {sharingRules.map((rule) => (
                  <li key={rule.label} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        rule.shared ? 'bg-sage-soft text-[#4F6244]' : 'bg-muted text-ink-muted'
                      }`}
                    >
                      {rule.shared ? (
                        <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brown-dark">
                        {rule.label}
                        <span
                          className={`ml-2 text-xs font-medium ${
                            rule.shared ? 'text-sage' : 'text-ink-muted'
                          }`}
                        >
                          {rule.shared ? 'Shared with consent' : 'Never shared by default'}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{rule.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Your data" title="Yours to see, take, and remove." />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dataRights.map((right, index) => (
              <Reveal key={right.title} delay={index * 70}>
                <Card padding="lg" tone="cream" className="h-full">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-brown">
                    <right.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-brown-dark">{right.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{right.copy}</p>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <AlertCard
              tone="urgent"
              icon={Shield}
              title="Soba is not an emergency service"
              className="mt-8"
            >
              If you or someone else is in immediate danger, contact local emergency services. In
              Indonesia, call 112, or reach the SEJIWA line on 119 extension 8.
            </AlertCard>
          </Reveal>
        </div>
      </section>

      <SafetySection />
      <FinalCTA />
    </>
  )
}
