import { HeartHandshake, Mic, Scale, ShieldCheck, Sprout, Users } from 'lucide-react'
import { PageHero } from '../../components/landing/PageHero'
import { FeatureGrid, FinalCTA } from '../../components/landing/Sections'
import { Card } from '../../components/ui/Card'
import { Reveal, SectionHeading } from '../../components/ui/Brand'

const principles = [
  {
    icon: ShieldCheck,
    title: 'Privacy first',
    copy: 'Private conversations remain private by default. Sharing is something you turn on, never something you have to turn off.',
  },
  {
    icon: Users,
    title: 'Consent led',
    copy: 'You decide who belongs in your Circle of Trust and exactly what each person can see.',
  },
  {
    icon: HeartHandshake,
    title: 'Human connection',
    copy: 'Soba is designed to move people toward each other, not to become the relationship itself.',
  },
  {
    icon: Scale,
    title: 'Non-diagnostic',
    copy: 'Soba shows patterns in your own words. It does not label, score, or diagnose anyone.',
  },
  {
    icon: Mic,
    title: 'Voice as the interface',
    copy: 'Speaking is how people process feelings. Typing is how people report them.',
  },
  {
    icon: Sprout,
    title: 'Calm by construction',
    copy: 'No streaks that punish, no notifications engineered to pull you back in.',
  },
]

const team = [
  { name: 'Product & Research', detail: 'Wellbeing UX, safety design, and clinical review workflows.' },
  { name: 'Engineering', detail: 'Voice pipeline, backend safety enforcement, and companion firmware.' },
  { name: 'Care Partners', detail: 'Licensed practitioners advising on escalation and referral pathways.' },
]

export default function About() {
  return (
    <>
      <PageHero
        eyebrow="About Soba"
        title={
          <>
            Built for the moment before
            <br />
            someone asks for help.
          </>
        }
        description="Soba began with a simple observation: most people do not go straight from struggling to seeking support. There is a long, quiet stretch in between, and almost nothing is designed for it."
      />

      <section className="py-20 lg:py-24">
        <div className="container-soba grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <SectionHeading eyebrow="Why we built it" title="A companion, not a clinician." />
          </Reveal>
          <Reveal delay={100} className="space-y-5 text-[15px] leading-relaxed text-ink-secondary">
            <p>
              Talking to a person about what you are feeling requires a kind of readiness that
              arrives late, if at all. Younger people in particular describe the same barrier:
              not knowing where to begin, and not wanting the first conversation to be a serious one.
            </p>
            <p>
              Soba is a voice-first companion for that stretch. It listens without judgment, offers
              grounding and reflection when they help, and keeps track of how things have been so
              nothing has to be recalled from scratch.
            </p>
            <p>
              It is deliberately not an AI psychologist. When a conversation moves toward something
              serious, Soba is designed to hand it to a human, not to hold it.
            </p>
            <p className="font-medium text-brown-dark">
              Some conversations should lead to a human. Soba is built to know which ones.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading
              align="center"
              eyebrow="Principles"
              title="What we hold to."
              description="Six commitments that shape every screen, prompt, and default in the product."
            />
          </Reveal>
          <div className="mt-12">
            <FeatureGrid items={principles} />
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Team" title="Who is behind Soba." />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {team.map((member, index) => (
              <Reveal key={member.name} delay={index * 80}>
                <Card padding="lg" className="h-full">
                  <h3 className="text-[17px] font-semibold tracking-headline text-brown-dark">{member.name}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-secondary">{member.detail}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <Card tone="cream" padding="lg" className="mt-6">
              <h3 className="text-lg font-semibold text-brown-dark">Contact</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                For partnerships, clinical review, or press: hello@soba.care. For anything urgent
                about your own safety, contact local emergency services rather than us.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      <FinalCTA />
    </>
  )
}
