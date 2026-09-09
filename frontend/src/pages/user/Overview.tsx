import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  Flame,
  Mic,
  NotebookPen,
  PhoneCall,
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
import { cn } from '../../lib/cn'
import { greeting } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { weeklyMood } from '../../data/mockMood'
import type { MoodLabel } from '../../types'

const moodOptions: MoodLabel[] = ['Calm', 'Okay', 'Tired', 'Stressed', 'Overwhelmed']

const quickActions = [
  { icon: Mic, label: 'Talk to Soba', detail: 'Start a voice session', to: '/app/user/soba' },
  { icon: Wind, label: 'Start Grounding', detail: 'Two minutes to settle', to: '/app/user/toolkit' },
  { icon: NotebookPen, label: 'Write Reflection', detail: 'Put it into words', to: '/app/user/journal' },
  { icon: PhoneCall, label: 'Reach Someone', detail: 'Your Circle of Trust', to: '/app/user/circle' },
]

export default function Overview() {
  const { user } = useAuth()
  const { moods, journal, contacts, addMood } = useAppData()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [selectedMood, setSelectedMood] = useState<MoodLabel | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)

  const latestReflection = journal[0]
  const activeContacts = contacts.filter((contact) => contact.status === 'active').length

  function handleCheckIn() {
    if (!selectedMood) return
    addMood(selectedMood)
    setCheckedIn(true)
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
      <Card padding="lg" tone="cream" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Quick check-in</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {checkedIn ? 'Saved for today. You can change it any time.' : 'One tap. Takes a second.'}
            </p>
          </div>
          {checkedIn ? <Badge tone="sage">Recorded today</Badge> : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {moodOptions.map((mood) => {
            const Icon = moodIcons[mood]
            const selected = selectedMood === mood
            return (
              <button
                key={mood}
                type="button"
                onClick={() => {
                  setSelectedMood(mood)
                  setCheckedIn(false)
                }}
                aria-pressed={selected}
                className={cn(
                  'flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all duration-200',
                  selected
                    ? 'border-apricot bg-surface shadow-soft'
                    : 'border-line bg-surface/70 hover:border-apricot/40 hover:bg-surface',
                )}
              >
                <Icon
                  className={cn('h-6 w-6', selected ? 'text-apricot' : 'text-brown-soft')}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    selected ? 'text-brown-dark' : 'text-ink-secondary',
                  )}
                >
                  {mood}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PrivacyNote>Check-ins are private. Guardians see direction over time, not entries.</PrivacyNote>
          <Button onClick={handleCheckIn} disabled={!selectedMood || checkedIn} className="sm:w-auto">
            {checkedIn ? 'Saved' : 'Save check-in'}
          </Button>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      <div className="mb-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Your week at a glance"
          description="Drawn from your own check-ins and conversations."
          action={
            <Link
              to="/app/user/mood"
              className="inline-flex items-center gap-1 text-sm font-medium text-brown hover:text-apricot"
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
              <p className="mt-3 text-center text-xs text-ink-muted">Only you can see this reflection.</p>
            </>
          ) : (
            <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-secondary">
              Your reflections will appear here when you choose to save something from a conversation.
            </p>
          )}
        </Card>
      </div>

      {/* Quick support */}
      <section aria-labelledby="quick-support">
        <h2 id="quick-support" className="mb-4 text-lg font-semibold tracking-tight text-brown-dark">
          Quick support
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="group">
              <Card interactive padding="lg" className="h-full">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown transition-colors group-hover:bg-apricot group-hover:text-white">
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-5 text-base font-semibold text-brown-dark">{action.label}</p>
                <p className="mt-1 text-sm text-ink-secondary">{action.detail}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-ink-muted">
        Soba shows patterns, never diagnoses. Recorded moods this month: {moods.length}.
      </p>
    </>
  )
}
