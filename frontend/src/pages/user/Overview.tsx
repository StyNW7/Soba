import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  Cpu,
  Mic,
  NotebookPen,
  PhoneCall,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react'
import { PageHeader, StatCard } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ChartCard } from '../../components/charts/chartTheme'
import { greeting } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import type {
  MoodEntry,
  Journal,
  Contact,
  Device,
  Preferences,
  Trends,
} from '../../api/schema'
import { trendRange } from '../../api/dates'
import { useRemote, date, words } from '../connected/state'
import { RemoteState } from '../connected/shared'
import { CheckIn } from '../connected/CheckIn'
import { TrendChart } from '../connected/TrendChart'

export default function Overview() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => Date.now())
  const navigate = useNavigate()
  const moodRemote = useRemote<MoodEntry[]>('/v1/mood-entries', true)
  const journalRemote = useRemote<Journal[]>('/v1/journals', true)
  const contactsRemote = useRemote<Contact[]>('/v1/trusted-contacts', true)
  const deviceRemote = useRemote<Device[]>('/v1/devices', true)
  const preferenceRemote = useRemote<Preferences>('/v1/me/preferences')
  const trend = useRemote<Trends>(`/v1/mood-trends?${trendRange()}`)
  const moods = moodRemote.value
  const journal = journalRemote.value
  const contacts = contactsRemote.value
  const latestReflection = journal?.[0]
  const activeContacts =
    contacts?.filter((c) => c.status === 'active').length ?? 0
  const device = deviceRemote.value?.find((d) => d.status !== 'revoked')
  const personalization = preferenceRemote.value
  const quickActions = [
    {
      icon: Mic,
      label: 'Talk to Soba',
      detail: 'Start a voice session',
      onClick: () => navigate('/app/user/soba'),
    },
    {
      icon: Wind,
      label: 'Start Grounding',
      detail: 'Take a moment to settle',
      onClick: () => navigate('/app/user/toolkit'),
    },
    {
      icon: NotebookPen,
      label: 'Your reflections',
      detail: 'Read what you chose to save',
      onClick: () => navigate('/app/user/journal'),
    },
    {
      icon: PhoneCall,
      label: 'Reach Someone',
      detail: 'Your Circle of Trust',
      onClick: () => navigate('/app/user/circle'),
    },
  ]
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.preferredName ?? 'there'}.`}
        description="How are you feeling today? There is no wrong answer, and you can skip this."
        action={
          <ButtonLink to="/app/user/soba" size="lg">
            <Mic className="h-4 w-4" aria-hidden="true" />
            Talk to Soba
          </ButtonLink>
        }
      />

      <CheckIn
        onSaved={() => {
          setNow(Date.now())
          moodRemote.reload()
          trend.reload()
        }}
      />
      <RemoteState remote={moodRemote} />
      {/* Summary cards */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="Weekly Check-ins"
          value={
            moods
              ? String(
                  moods.filter(
                    (m) =>
                      now - Date.parse(m.occurred_at) >= 0 &&
                      now - Date.parse(m.occurred_at) < 7 * 86400000,
                  ).length,
                )
              : '—'
          }
          hint="Out of the last 7 days"
        />
        <StatCard
          icon={NotebookPen}
          label="Saved reflections"
          value={journal ? String(journal.length) : '—'}
          hint="Your private journal"
        />
        <StatCard
          icon={CalendarCheck}
          label="Recorded check-ins"
          value={moods ? String(moods.length) : '—'}
          hint="Saved to your account"
        />
        <StatCard
          icon={Users}
          label="Trusted People"
          value={contacts ? String(activeContacts) : '—'}
          hint="Active in your circle"
        />
      </div>

      {/* Trend + reflection */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Your month at a glance"
          height="auto"
          description="Drawn from your own check-ins and conversations."
          action={
            <Link
              to="/app/user/mood"
              className="inline-flex items-center gap-1 text-sm font-medium text-brown transition-colors hover:text-apricot"
            >
              View patterns
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          }
          footer={
            <p className="text-sm leading-relaxed text-ink-secondary">
              Counts of your saved mood labels. No wellbeing score is inferred.
            </p>
          }
        >
          <RemoteState remote={trend} />
          {trend.value && <TrendChart value={trend.value} />}
        </ChartCard>

        <Card padding="lg" className="flex flex-col">
          <RemoteState remote={journalRemote} />
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">
              Recent reflection
            </h2>
          </div>

          {latestReflection ? (
            <>
              <p className="mt-4 text-xs text-ink-muted">
                {date(latestReflection.created_at)}
              </p>
              <h3 className="mt-1.5 font-serif text-2xl leading-snug text-brown-dark">
                {latestReflection.topic}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary">
                {latestReflection.reflection}
              </p>
              <div className="mt-6">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate('/app/user/journal')}
                >
                  Open Reflection
                </Button>
              </div>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Only you can see this reflection.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-secondary">
                Your reflections will appear here when you choose to save
                something from a conversation.
              </p>
              <div className="mt-6">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate('/app/user/soba')}
                >
                  Start a conversation
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Quick support */}
      <section aria-labelledby="quick-support" className="mb-5">
        <h2
          id="quick-support"
          className="rule-accent mb-4 text-[17px] font-semibold tracking-headline text-brown-dark"
        >
          Quick support
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="group text-left"
            >
              <Card interactive padding="lg" className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown transition-colors duration-300 group-hover:bg-apricot group-hover:text-white">
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-5 text-base font-semibold text-brown-dark">
                  {action.label}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  {action.detail}
                </p>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {/* Companion + personalization status */}
      <RemoteState remote={contactsRemote} />
      <RemoteState remote={deviceRemote} />
      <RemoteState remote={preferenceRemote} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Card padding="lg" className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-brown">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brown-dark">
              {device
                ? device.name
                : deviceRemote.value
                  ? 'No companion paired'
                  : 'Device status unavailable'}
            </p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {device
                ? `${words(device.status)} · ${device.battery_percent === null ? 'Battery not reported' : `battery ${device.battery_percent}%`}`
                : 'The app works fully without hardware.'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/user/device')}
          >
            {device ? 'Manage' : 'Pair'}
          </Button>
        </Card>

        <Card padding="lg" className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-brown">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize text-brown-dark">
              {personalization
                ? `${personalization.personality} voice · ${personalization.voice}`
                : 'Preferences unavailable'}
            </p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Soba{' '}
              {personalization?.listen_first
                ? 'listens before suggesting'
                : 'offers suggestions sooner'}
              {personalization?.memory_enabled
                ? ' and may use saved memories'
                : ' and does not use memories'}
              .
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/user/personalization')}
          >
            Adjust
          </Button>
        </Card>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-muted">
        Soba shows patterns, never diagnoses. Recorded check-ins:{' '}
        {moods?.length ?? '—'}.
      </p>
    </>
  )
}
