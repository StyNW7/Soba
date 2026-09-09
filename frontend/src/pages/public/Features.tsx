import {
  Activity,
  BatteryMedium,
  BellRing,
  BookOpenText,
  LockKeyhole,
  MessageCircle,
  Mic,
  NotebookPen,
  Stethoscope,
  TrendingUp,
  Users,
  Wind,
} from 'lucide-react'
import { PageHero } from '../../components/landing/PageHero'
import { EcosystemSection, FeatureGrid, FinalCTA, RoleSection } from '../../components/landing/Sections'
import { Reveal, SectionHeading } from '../../components/ui/Brand'

const userFeatures = [
  {
    icon: Mic,
    title: 'Talk to Soba',
    copy: 'A voice conversation that starts wherever you are, with a live transcript you can follow.',
  },
  {
    icon: TrendingUp,
    title: 'Mood & Patterns',
    copy: 'Trends drawn from your own check-ins and conversations. Patterns, never diagnoses.',
  },
  {
    icon: NotebookPen,
    title: 'Journal & Reflection',
    copy: 'Short summaries you choose to keep, searchable and visible only to you.',
  },
  {
    icon: Wind,
    title: 'Wellbeing Toolkit',
    copy: 'Grounding, breathing, and wind-down sessions you can start in one tap.',
  },
  {
    icon: Users,
    title: 'Circle of Trust',
    copy: 'The people Soba can help you reach, with permissions you set person by person.',
  },
  {
    icon: LockKeyhole,
    title: 'Memory & Privacy',
    copy: 'See exactly what Soba remembers, edit it, delete it, or export everything.',
  },
]

const guardianFeatures = [
  {
    icon: Activity,
    title: 'Wellbeing Pulse',
    copy: 'A high-level view of how the week has gone, without a single line of conversation.',
  },
  {
    icon: TrendingUp,
    title: 'Mood Trends',
    copy: 'Aggregated direction over time, shared only while consent is active.',
  },
  {
    icon: BellRing,
    title: 'Safety Alerts',
    copy: 'A clear signal when Soba recommends checking in, with next steps that are actually useful.',
  },
  {
    icon: MessageCircle,
    title: 'Reach Out',
    copy: 'Call, message, or video, with a suggested opener when you do not know how to start.',
  },
  {
    icon: BookOpenText,
    title: 'Parent Coach',
    copy: 'Short modules on listening, responding to distress, and supporting without intruding.',
  },
  {
    icon: Stethoscope,
    title: 'Professional pathways',
    copy: 'Verified practitioners and crisis resources, so escalation has somewhere to go.',
  },
]

const deviceFeatures = [
  {
    icon: Mic,
    title: 'Push-to-talk or wake word',
    copy: 'Choose how the companion listens. A physical microphone state is always visible.',
  },
  {
    icon: BatteryMedium,
    title: 'Multi-day battery',
    copy: 'Designed to sit on a bedside table, not to be charged nightly.',
  },
  {
    icon: LockKeyhole,
    title: 'Nothing stored on device',
    copy: 'Memory sync is explicit, reviewable, and reversible from the app.',
  },
]

export default function Features() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything Soba does, and everything it deliberately does not."
        description="Two experiences built on the same journey: one for the person doing the feeling, one for the person trying to help."
      />

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading
              eyebrow="For you"
              title="Your feelings. Your space. Your choice."
              description="Six surfaces that cover the everyday, without turning wellbeing into a scoreboard."
            />
          </Reveal>
          <div className="mt-12">
            <FeatureGrid items={userFeatures} />
          </div>
        </div>
      </section>

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading
              eyebrow="For parents & guardians"
              title="Support without invading privacy."
              description="Enough signal to know when to step closer. Never enough to read the private story."
            />
          </Reveal>
          <div className="mt-12">
            <FeatureGrid items={guardianFeatures} />
          </div>
        </div>
      </section>

      <EcosystemSection />

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Companion hardware" title="Designed to be present, not watching." />
          </Reveal>
          <div className="mt-12">
            <FeatureGrid items={deviceFeatures} />
          </div>
        </div>
      </section>

      <RoleSection />
      <FinalCTA />
    </>
  )
}
