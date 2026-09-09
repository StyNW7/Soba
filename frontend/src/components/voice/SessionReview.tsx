import { useEffect, useMemo, useState } from 'react'
import { Brain, Check, Clock, NotebookPen, ShieldCheck, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { MoodIcon } from '../ui/Brand'
import type { SessionDraft } from '../../types'

interface SessionReviewProps {
  open: boolean
  draft: SessionDraft | null
  onClose: () => void
  onSave: (choices: { saveJournal: boolean; saveMood: boolean; memoryIds: string[] }) => void
  onDiscard: () => void
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * The end-of-conversation summary (F4). Each choice is independent and starts
 * off: the draft expires rather than being saved by default, and turning
 * everything off is the same as discarding.
 */
export function SessionReview({ open, draft, onClose, onSave, onDiscard }: SessionReviewProps) {
  const [saveJournal, setSaveJournal] = useState(false)
  const [saveMood, setSaveMood] = useState(false)
  const [memoryIds, setMemoryIds] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!open) return
    setSaveJournal(false)
    setSaveMood(false)
    setMemoryIds([])
  }, [open, draft?.id])

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [open])

  const remaining = draft ? draft.expiresAt - now : 0
  const expired = draft ? remaining <= 0 : false
  const nothingSelected = !saveJournal && !saveMood && memoryIds.length === 0

  const safety = useMemo(() => {
    switch (draft?.safetyLevel) {
      case 'elevated':
        return { label: 'Elevated — human support suggested', tone: 'terracotta' as const }
      case 'monitor':
        return { label: 'Worth keeping an eye on', tone: 'amber' as const }
      default:
        return { label: 'No safety concern detected', tone: 'sage' as const }
    }
  }, [draft?.safetyLevel])

  if (!draft) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review this conversation"
      description="Nothing has been saved yet. Each choice below is separate, and all of them start off."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onDiscard}>
            Discard
          </Button>
          <Button
            data-autofocus
            disabled={expired}
            onClick={() =>
              nothingSelected ? onDiscard() : onSave({ saveJournal, saveMood, memoryIds })
            }
          >
            {nothingSelected ? 'Save nothing' : 'Save selected'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Expiry */}
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm',
            expired ? 'bg-terracotta-soft text-terracotta-dark' : 'bg-muted text-ink-secondary',
          )}
          role={expired ? 'alert' : undefined}
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          {expired ? (
            <span>This draft has expired and was not saved. Nothing was kept.</span>
          ) : (
            <span>
              This draft is held for{' '}
              <span className="font-semibold text-brown-dark">{formatRemaining(remaining)}</span> more,
              then discarded automatically.
            </span>
          )}
        </div>

        {/* Structured summary */}
        <div className="rounded-3xl border border-line bg-cream/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-brown-dark">{draft.topic}</h3>
            <div className="flex items-center gap-2">
              <Badge tone="cream" icon={<MoodIcon mood={draft.mood} />}>
                {draft.mood}
              </Badge>
              <Badge tone={safety.tone}>{safety.label}</Badge>
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{draft.reflection}</p>

          {draft.insights.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {draft.insights.map((insight) => (
                <li
                  key={insight}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-brown-dark"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-apricot" aria-hidden="true" />
                  {insight}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Independent choices */}
        <fieldset disabled={expired} className="space-y-3">
          <legend className="mb-2 text-sm font-semibold text-brown-dark">What would you like to keep?</legend>

          <ChoiceRow
            icon={NotebookPen}
            checked={saveJournal}
            onChange={setSaveJournal}
            title="Save to journal"
            detail="Keeps the reflection above. Only you can read it."
          />
          <ChoiceRow
            icon={TrendingUp}
            checked={saveMood}
            onChange={setSaveMood}
            title={`Save mood as "${draft.mood}"`}
            detail="Adds one entry to your mood history. It affects your own patterns only."
          />

          <div className="rounded-2xl border border-line p-4">
            <p className="flex items-center gap-2.5 text-sm font-semibold text-brown-dark">
              <Brain className="h-4 w-4 text-brown-soft" aria-hidden="true" />
              Remember for next time
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
              Select individually. Saving a fact is separate from letting Soba use it, which stays
              under your control in Memory &amp; Privacy.
            </p>
            <ul className="mt-3 space-y-2">
              {draft.memoryCandidates.map((candidate) => {
                const selected = memoryIds.includes(candidate.id)
                return (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setMemoryIds((current) =>
                          selected
                            ? current.filter((id) => id !== candidate.id)
                            : [...current, candidate.id],
                        )
                      }
                      aria-pressed={selected}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                        selected
                          ? 'border-apricot bg-apricot-soft/50'
                          : 'border-line bg-muted/40 hover:bg-cream/60',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                          selected ? 'border-apricot bg-apricot text-white' : 'border-line',
                        )}
                      >
                        {selected ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : null}
                      </span>
                      <span className="min-w-0 text-sm leading-relaxed text-brown-dark">
                        {candidate.text}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </fieldset>

        <p className="inline-flex items-start gap-2 rounded-2xl bg-sage-soft px-3.5 py-2.5 text-xs leading-relaxed text-sage-deep">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Raw audio is not stored. Anything you do not select here is discarded and never reaches a
          guardian.
        </p>
      </div>
    </Modal>
  )
}

function ChoiceRow({
  icon: Icon,
  checked,
  onChange,
  title,
  detail,
}: {
  icon: typeof NotebookPen
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        'flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors',
        checked ? 'border-apricot bg-apricot-soft/50' : 'border-line hover:bg-cream/50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
          checked ? 'border-apricot bg-apricot text-white' : 'border-line',
        )}
      >
        {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-brown-dark">
          <Icon className="h-4 w-4 text-brown-soft" aria-hidden="true" />
          {title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-secondary">{detail}</span>
      </span>
    </button>
  )
}
