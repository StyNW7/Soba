import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarCheck, HeartHandshake, ShieldCheck, TrendingUp } from 'lucide-react'
import { PageHeader, PrivacyNote, StatCard } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { ChartCard } from '../../components/charts/chartTheme'
import { MoodAreaChart } from '../../components/charts/MoodCharts'
import { SafetyAlertBanner } from '../../components/dashboard/SafetyAlertBanner'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { coachModules, guardianTrend } from '../../data/mockGuardian'

export default function Overview() {
  const { user } = useAuth()
  const { alerts, acknowledgeAlert } = useAppData()
  const subject = user?.subjectName ?? 'Nara'
  const openAlert = alerts.find((alert) => alert.status === 'open')
  const openCount = alerts.filter((alert) => alert.status === 'open').length

  return (
    <>
      <PageHeader
        eyebrow="Guardian view"
        title={`${subject}'s Wellbeing`}
        description="A high-level view designed to help you stay connected without reading private conversations."
        action={
          <Badge tone="sage" size="md" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            Private conversations remain private
          </Badge>
        }
      />

      {openAlert ? (
        <div className="mb-6">
          <SafetyAlertBanner
            alert={openAlert}
            subjectName={subject}
            onAcknowledge={() => acknowledgeAlert(openAlert.id)}
          />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Weekly Check-ins" value="5" hint="Out of the last 7 days" />
        <StatCard icon={TrendingUp} label="Overall Trend" value="Stable" hint="Compared with last week" />
        <StatCard icon={HeartHandshake} label="Human Connections" value="2" hint="Reached out this week" />
        <StatCard
          icon={BellRing}
          label="Open Safety Alerts"
          value={String(openCount)}
          hint={openCount === 0 ? 'Nothing needs urgent attention' : 'Review recommended'}
          tone={openCount > 0 ? 'cream' : 'surface'}
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="This week"
          description="Aggregated wellbeing direction. Individual entries are not shared."
          action={
            <Link
              to="/app/guardian/trends"
              className="inline-flex items-center gap-1 text-sm font-medium text-brown hover:text-apricot"
            >
              View trends
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
          footer={<PrivacyNote>Only high-level wellbeing patterns are shared with you.</PrivacyNote>}
        >
          <MoodAreaChart data={guardianTrend} />
        </ChartCard>

        <Card tone="cream" padding="lg" className="flex flex-col">
          <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Wellbeing pulse</h2>
          <p className="mt-1 text-sm text-ink-secondary">A support status, not a diagnosis.</p>

          <div className="my-7 flex flex-col items-center">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E7DED2" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#D4954D"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${0.72 * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="font-serif text-2xl text-brown-dark">Stable</span>
                <span className="text-xs text-ink-muted">this week</span>
              </div>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-ink-secondary">
            {subject} completed five check-ins this week. Most were neutral to positive, with one
            difficult day.
          </p>
          <div className="mt-6">
            <ButtonLink to="/app/guardian/wellbeing" variant="secondary" fullWidth>
              Open wellbeing pulse
            </ButtonLink>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padding="lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Recent alerts</h2>
              <p className="mt-1 text-sm text-ink-secondary">No conversation content is included.</p>
            </div>
            <Link
              to="/app/guardian/alerts"
              className="shrink-0 text-sm font-medium text-brown hover:text-apricot"
            >
              View all
            </Link>
          </div>
          <ul className="mt-5 divide-y divide-line">
            {alerts.slice(0, 3).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brown-dark">{alert.title}</p>
                  <p className="text-xs text-ink-muted">{alert.date}</p>
                </div>
                <Badge
                  tone={
                    alert.status === 'open' ? 'terracotta' : alert.status === 'acknowledged' ? 'amber' : 'sage'
                  }
                >
                  {alert.status === 'open'
                    ? 'Needs attention'
                    : alert.status === 'acknowledged'
                      ? 'Acknowledged'
                      : 'Resolved'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Parent Coach</h2>
              <p className="mt-1 text-sm text-ink-secondary">Short guidance, reviewed before publishing.</p>
            </div>
            <Link
              to="/app/guardian/coach"
              className="shrink-0 text-sm font-medium text-brown hover:text-apricot"
            >
              Open
            </Link>
          </div>
          <ul className="mt-5 space-y-3">
            {coachModules.slice(0, 3).map((module) => (
              <li key={module.id} className="rounded-2xl bg-cream/70 px-4 py-3.5">
                <p className="text-sm font-semibold text-brown-dark">{module.title}</p>
                <p className="mt-1 text-xs text-ink-secondary">{module.duration}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
