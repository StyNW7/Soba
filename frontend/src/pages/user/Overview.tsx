import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Cpu,
  Flame,
  Mic,
  NotebookPen,
  PhoneCall,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react'
import { PageHeader, PrivacyNote, StatCard } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { MoodIcon, moodIcons } from '../../components/ui/Brand'
import { ChartCard } from '../../components/charts/chartTheme'
import { MoodAreaChart } from '../../components/charts/MoodCharts'
import { ContactRequestModal } from '../../components/dashboard/ContactRequestModal'
import { cn } from '../../lib/cn'
import { greeting } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { weeklyMood } from '../../data/mockMood'
import type { MoodLabel } from '../../types'

const moodOptions: MoodLabel[] = ['Calm', 'Okay', 'Tired', 'Stressed', 'Overwhelmed']

export default function Overview() {
  const { user } = useAuth()
  const { moods, journal, contacts, addMood, device, personalization } = useAppData()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [selectedMood, setSelectedMood] = useState<MoodLabel | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)

  const latestReflection = journal[0]
  const activeContacts = contacts.filter((contact) => contact.status === 'active').length
  const todayEntry = moods.find((entry) => entry.date === 'Today')
  const checkedIn = Boolean(todayEntry)

  const quickActions = useMemo(
    () => [
      { icon: Mic, label: 'Talk to Soba', detail: 'Start a voice session', onClick: () => navigate('/app/user/soba') },
      { icon: Wind, label: 'Start Grounding', detail: 'Two minutes to settle', onClick: () => navigate('/app/user/toolkit') },
      { icon: NotebookPen, label: 'Write Reflection', detail: 'Put it into words', onClick: () => navigate('/app/user/journal') },
      { icon: PhoneCall, label: 'Reach Someone', detail: 'Your Circle of Trust', onClick: () => setRequestOpen(true) },
    ],
    [navigate],
  )

  function handleCheckIn() {
    if (!selectedMood) return
    addMood(selectedMood)
    setSelectedMood(null)
    toast('Check-in saved', { description: 'Only you can see this.' })
  }

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

      {/* Quick mood check-in */}
      <Card padding="lg" tone="cream" className="mesh-warm relative mb-5 overflow-hidden">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Quick check-in</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {checkedIn
                ? `Recorded as "${todayEntry?.label}" today. Choose again to change it.`
                : 'One tap. Takes a second.'}
            </p>
          </div>
          {checkedIn ? (
            <Badge tone="sage" icon={<Check className="h-3 w-3" />}>
              Recorded today
            </Badge>
          ) : null}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {moodOptions.map((mood) => {
            const Icon = moodIcons[mood]
            const selected = selectedMood === mood
            const isToday = !selectedMood && todayEntry?.label === mood
            const highlighted = selected || isToday
            return (
              <button
                key={mood}
                type="button"
                onClick={() => setSelectedMood(mood)}
                aria-pressed={highlighted}
                className={cn(
                  'flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all duration-200',
                  highlighted
                    ? 'border-apricot bg-surface shadow-soft'
                    : 'border-line bg-surface/70 hover:-translate-y-0.5 hover:border-apricot/40 hover:bg-surface',
                )}
              >
                <Icon
                  className={cn('h-6 w-6', highlighted ? 'text-apricot' : 'text-brown-soft')}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    highlighted ? 'text-brown-dark' : 'text-ink-secondary',
                  )}
                >
                  {mood}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PrivacyNote>
            Check-ins are private. Guardians see direction over time, not entries.
          </PrivacyNote>
          <Button onClick={handleCheckIn} disabled={!selectedMood} className="sm:w-auto">
            {checkedIn ? 'Update check-in' : 'Save check-in'}
          </Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarCheck} label="Weekly Check-ins" value="5" hint="Out of the last 7 days" />
        <StatCard icon={Flame} label="Current Streak" value="6 days" hint="No pressure to keep it going" />
        <StatCard icon={Wind} label="Grounding Sessions" value="3" hint="This week" />
        <StatCard
          icon={Users}
          label="Trusted People"
          value={String(activeContacts)}
          hint="Active in your circle"
        />
      </div>

      {/* Trend + reflection */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Your week at a glance"
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
              Your check-ins were slightly more difficult around Wednesday and Thursday.
            </p>
          }
        >
          <MoodAreaChart data={weeklyMood} />
        </ChartCard>

        <Card padding="lg" className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Recent reflection</h2>
            {latestReflection ? (
              <Badge tone="cream" icon={<MoodIcon mood={latestReflection.mood} />}>
                {latestReflection.mood}
              </Badge>
            ) : null}
          </div>

          {latestReflection ? (
            <>
              <p className="mt-4 text-xs text-ink-muted">{latestReflection.date}</p>
              <h3 className="mt-1.5 font-serif text-2xl leading-snug text-brown-dark">
                {latestReflection.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-secondary">
                {latestReflection.summary}
              </p>
              <div className="mt-6">
                <Button variant="secondary" fullWidth onClick={() => navigate('/app/user/journal')}>
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
                Your reflections will appear here when you choose to save something from a
                conversation.
              </p>
              <div className="mt-6">
                <Button variant="secondary" fullWidth onClick={() => navigate('/app/user/soba')}>
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
          className="rule-accent mb-4 text-lg font-semibold tracking-tight text-brown-dark"
        >
          Quick support
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <button key={action.label} type="button" onClick={action.onClick} className="group text-left">
              <Card interactive padding="lg" className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown transition-colors duration-300 group-hover:bg-apricot group-hover:text-white">
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-5 text-base font-semibold text-brown-dark">{action.label}</p>
                <p className="mt-1 text-sm text-ink-secondary">{action.detail}</p>
              </Card>
            </button>
          ))}
        </div>
      </section>

      {/* Companion + personalization status */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card padding="lg" className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-brown">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brown-dark">
              {device ? device.name : 'No companion paired'}
            </p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {device
                ? `${device.status === 'connected' ? 'Connected' : 'Offline'} · battery ${device.battery}% · synced ${device.lastSync}`
                : 'The app works fully without hardware.'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/user/device')}>
            {device ? 'Manage' : 'Pair'}
          </Button>
        </Card>

        <Card padding="lg" className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cream text-brown">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize text-brown-dark">
              {personalization.personality} voice · {personalization.voiceId}
            </p>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Soba {personalization.listenFirst ? 'listens before suggesting' : 'offers suggestions sooner'}
              {personalization.useMemory ? ' and may use saved memories' : ' and does not use memories'}.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/user/personalization')}>
            Adjust
          </Button>
        </Card>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-muted">
        Soba shows patterns, never diagnoses. Recorded check-ins: {moods.length}.
      </p>

      <ContactRequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        contacts={contacts}
      />
    </>
  )
}
