import { useEffect, useState } from 'react'
import { Clock, Pause, Play, Square, Wind } from 'lucide-react'
import { PageHeader } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Progress, Tabs } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { toolkitActivities, toolkitCategories } from '../../data/mockToolkit'
import type { ToolkitActivity } from '../../types'

export default function Toolkit() {
  const { toast } = useToast()
  const [category, setCategory] = useState<string>('All')
  const [active, setActive] = useState<ToolkitActivity | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)

  const filtered =
    category === 'All'
      ? toolkitActivities
      : toolkitActivities.filter((activity) => activity.category === category)

  const step = active?.steps[stepIndex]

  useEffect(() => {
    if (!playing || !active || !step) return
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= step.seconds) {
          if (stepIndex + 1 < active.steps.length) {
            setStepIndex((index) => index + 1)
            return 0
          }
          setPlaying(false)
          toast('Session complete', { description: 'Nothing was recorded. This is just for you.' })
          return step.seconds
        }
        return current + 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing, active, step, stepIndex, toast])

  function start(activity: ToolkitActivity) {
    setActive(activity)
    setStepIndex(0)
    setElapsed(0)
    setPlaying(false)
  }

  function close() {
    setActive(null)
    setPlaying(false)
    setStepIndex(0)
    setElapsed(0)
  }

  return (
    <>
      <PageHeader
        title="Wellbeing Toolkit"
        description="Short practices for the moments in between. Nothing here is tracked or scored."
        action={
          <Tabs
            tabs={toolkitCategories.map((item) => ({ value: item, label: item }))}
            value={category}
            onChange={setCategory}
            size="sm"
          />
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((activity) => (
          <Card key={activity.id} padding="lg" interactive className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown">
                <Wind className="h-5 w-5" aria-hidden="true" />
              </span>
              <Badge tone="cream">{activity.category}</Badge>
            </div>

            <h2 className="mt-5 text-lg font-semibold tracking-tight text-brown-dark">{activity.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{activity.description}</p>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {activity.durationMinutes} min
              </span>
              <Button size="sm" onClick={() => start(activity)}>
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                Start
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(active)}
        onClose={close}
        title={active?.title ?? ''}
        description={active ? `${active.category} · ${active.durationMinutes} minutes` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Stop
            </Button>
            <Button onClick={() => setPlaying((value) => !value)} data-autofocus>
              {playing ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {elapsed > 0 || stepIndex > 0 ? 'Resume' : 'Begin'}
                </>
              )}
            </Button>
          </>
        }
      >
        {active && step ? (
          <div className="space-y-6">
            <div className="rounded-3xl bg-cream px-6 py-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                Step {stepIndex + 1} of {active.steps.length}
              </p>
              <h3 className="mt-3 font-serif text-[28px] leading-snug text-brown-dark">{step.title}</h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-secondary">
                {step.instruction}
              </p>
              <div
                className={`mx-auto mt-8 h-24 w-24 rounded-full bg-gradient-to-br from-[#F0DCC0] to-[#D4954D] ${
                  playing ? 'animate-breathe' : ''
                }`}
                aria-hidden="true"
              />
            </div>

            <Progress
              value={elapsed}
              max={step.seconds}
              label={`${step.seconds - elapsed}s remaining in this step`}
            />

            <ol className="space-y-2">
              {active.steps.map((item, index) => (
                <li
                  key={item.title}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    index === stepIndex
                      ? 'bg-apricot-soft/60 font-medium text-brown-dark'
                      : 'text-ink-muted'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                      index < stepIndex
                        ? 'bg-sage text-white'
                        : index === stepIndex
                          ? 'bg-apricot text-white'
                          : 'bg-muted text-ink-muted'
                    }`}
                  >
                    {index + 1}
                  </span>
                  {item.title}
                </li>
              ))}
            </ol>

            <p className="text-xs leading-relaxed text-ink-muted">
              You can stop at any point. Completing a session is not recorded as a mood entry.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
