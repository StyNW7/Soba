import { CalendarCheck, HeartHandshake, Info, MessageCircle, TrendingUp } from 'lucide-react'
import { PageHeader, PrivacyNote, StatCard } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { RadialProgress } from '../../components/ui/Controls'
import { ChartCard } from '../../components/charts/chartTheme'
import { MoodBarChart } from '../../components/charts/MoodCharts'
import { useAuth } from '../../context/AuthContext'
import { guardianCheckins } from '../../data/mockGuardian'

const observations = [
  'Five check-ins were completed this week, one more than last week.',
  'One day was noticeably more difficult than the rest.',
  'A conversation with someone in the Circle of Trust happened on Saturday.',
]

export default function WellbeingPulse() {
  const { user } = useAuth()
  const subject = user?.subjectName ?? 'Nara'

  return (
    <>
      <PageHeader
        title="Wellbeing Pulse"
        description={`A support status for ${subject}. This is not a clinical score and does not describe a condition.`}
        action={<Badge tone="sage" size="md">Support status, not a diagnosis</Badge>}
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card tone="cream" padding="lg" className="flex flex-col items-center text-center">
          <div className="mt-4">
            <RadialProgress
              value={72}
              size={212}
              stroke={11}
              label={
                <span className="flex flex-col items-center">
                  <span className="font-serif text-[30px] leading-none text-brown-dark">Generally</span>
                  <span className="text-gradient-warm font-serif text-[32px] leading-tight">Stable</span>
                </span>
              }
            />
          </div>

          <p className="mt-7 max-w-sm text-sm leading-relaxed text-ink-secondary">
            {subject} completed five check-ins this week. Most were neutral to positive, with one
            difficult day.
          </p>

          <div className="mt-7 w-full">
            <ButtonLink to="/app/guardian/reach-out" fullWidth>
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Reach out
            </ButtonLink>
          </div>
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <StatCard icon={CalendarCheck} label="Check-ins" value="5" hint="This week" />
          <StatCard icon={TrendingUp} label="Direction" value="Steady" hint="Compared with last week" />
          <StatCard icon={HeartHandshake} label="Human connections" value="2" hint="Reached out this week" />
          <StatCard icon={Info} label="Difficult days" value="1" hint="Thursday" tone="cream" />

          <Card padding="lg" className="sm:col-span-2">
            <h2 className="text-base font-semibold text-brown-dark">What this view is</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              A summary of activity and direction, produced from aggregated check-ins. It does not
              contain topics, transcripts, journal entries, or any assessment of mental health.
            </p>
            <PrivacyNote className="mt-4">
              If {subject} withdraws sharing, this page becomes unavailable rather than showing stale
              information.
            </PrivacyNote>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <ChartCard
          title="Check-in activity"
          description="How often check-ins were completed this week."
          height={240}
        >
          <MoodBarChart data={guardianCheckins} xKey="day" dataKey="count" domain={[0, 2]} />
        </ChartCard>

        <Card padding="lg">
          <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">Observations</h2>
          <p className="mt-1 text-sm text-ink-secondary">Factual, non-interpretive notes.</p>
          <ul className="mt-5 space-y-3">
            {observations.map((observation) => (
              <li
                key={observation}
                className="rounded-2xl bg-cream/70 px-4 py-3.5 text-sm leading-relaxed text-brown-dark"
              >
                {observation}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
