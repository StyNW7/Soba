import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Controls'
import { useToast } from '../../context/ToastContext'
import type { ToolkitActivity } from '../../types'

interface GroundingPlayerProps {
  open: boolean
  activity: ToolkitActivity | null
  onClose: () => void
}

/**
 * Step player for toolkit activities (C5, U5). Nothing here is recorded: a
 * completed session is deliberately not written as a mood entry.
 */
export function GroundingPlayer({ open, activity, onClose }: GroundingPlayerProps) {
  const { toast } = useToast()
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)

  const step = activity?.steps[stepIndex]

  // Reset whenever a different activity is opened.
  useEffect(() => {
    if (!open) return
    setStepIndex(0)
    setElapsed(0)
    setPlaying(false)
    setFinished(false)
  }, [open, activity?.id])

  // Transitions live in the effect body, not inside a state updater, so React's
  // double-invocation in development cannot skip a step or fire the toast twice.
  useEffect(() => {
    if (!playing || !activity || !step) return

    if (elapsed >= step.seconds) {
      if (stepIndex + 1 < activity.steps.length) {
        setStepIndex((index) => index + 1)
        setElapsed(0)
      } else {
        setPlaying(false)
        setFinished(true)
        toast('Session complete', { description: 'Nothing was recorded. This was just for you.' })
      }
      return
    }

    const timer = window.setTimeout(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearTimeout(timer)
  }, [playing, activity, step, stepIndex, elapsed, toast])

  if (!activity || !step) return null

  const totalSeconds = activity.steps.reduce((sum, item) => sum + item.seconds, 0)
  const doneSeconds =
    activity.steps.slice(0, stepIndex).reduce((sum, item) => sum + item.seconds, 0) + elapsed

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={activity.title}
      description={`${activity.category} · about ${activity.durationMinutes} minutes`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            Stop
          </Button>
          {finished ? (
            <Button
              data-autofocus
              onClick={() => {
                setStepIndex(0)
                setElapsed(0)
                setFinished(false)
                setPlaying(true)
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Start again
            </Button>
          ) : (
            <Button data-autofocus onClick={() => setPlaying((value) => !value)}>
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
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="rounded-3xl bg-cream px-6 py-10 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {finished ? 'Complete' : `Step ${stepIndex + 1} of ${activity.steps.length}`}
          </p>
          <h3 className="mt-3 font-serif text-[28px] leading-snug text-brown-dark">
            {finished ? 'That is the whole thing.' : step.title}
          </h3>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-secondary">
            {finished
              ? 'You can go back to what you were doing, or run it again if it helped.'
              : step.instruction}
          </p>

          {/* The circle paces the breath: expanding while playing, still when paused. */}
          <div
            className={cn(
              'mx-auto mt-8 h-24 w-24 rounded-full bg-gradient-to-br from-[#F0DCC0] to-[#D4954D] transition-transform duration-700',
              playing ? 'animate-breathe' : 'scale-95 opacity-70',
            )}
            aria-hidden="true"
          />
        </div>

        {!finished ? (
          <>
            <Progress
              value={elapsed}
              max={step.seconds}
              label={`${Math.max(0, step.seconds - elapsed)}s remaining in this step`}
            />
            <Progress
              value={doneSeconds}
              max={totalSeconds}
              label="Whole session"
              tone="sage"
              showValue
            />
          </>
        ) : null}

        <ol className="space-y-2">
          {activity.steps.map((item, index) => (
            <li
              key={item.title}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                index === stepIndex && !finished
                  ? 'bg-apricot-soft/60 font-medium text-brown-dark'
                  : 'text-ink-muted',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                  index < stepIndex || finished
                    ? 'bg-sage text-white'
                    : index === stepIndex
                      ? 'bg-apricot text-white'
                      : 'bg-muted text-ink-muted',
                )}
              >
                {index + 1}
              </span>
              {item.title}
            </li>
          ))}
        </ol>

        <p className="text-xs leading-relaxed text-ink-muted">
          You can stop at any point. Completing a session is not recorded and is not saved as a mood
          entry.
        </p>
      </div>
    </Modal>
  )
}
