import { useState } from 'react'
import { SobaBear } from '../../components/ui/SobaBear'
import { api } from '../../api/client'
import type { MoodEntry } from '../../api/schema'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { PrivacyNote } from '../../components/ui/Feedback'
import { cn } from '../../lib/cn'
import { Feedback } from './shared'
import { useAction, words } from './state'

const options = [
  { label: 'very_low', pose: 'sad' },
  { label: 'low', pose: 'sad' },
  { label: 'neutral', pose: 'neutral' },
  { label: 'good', pose: 'happy' },
  { label: 'very_good', pose: 'cute' },
  { label: 'unknown', pose: 'thinking' },
] as const

export function CheckIn({ onSaved }: { onSaved: () => void }) {
  const [selected, setSelected] = useState<MoodEntry['label'] | null>(null)
  const action = useAction()
  return (
    <Card
      padding="lg"
      tone="cream"
      className="mesh-warm relative mb-5 overflow-hidden"
    >
      <h2 className="relative text-[17px] font-semibold tracking-headline text-brown-dark">
        Quick check-in
      </h2>
      <p className="relative mt-1 text-sm text-ink-secondary">
        How are you feeling? Each check-in is saved to your account.
      </p>
      <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {options.map(({ label, pose }) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === label}
            disabled={action.busy}
            onClick={() => setSelected(label)}
            className={cn(
              'flex min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border px-3 py-4 transition-colors focus-visible:ring-2 focus-visible:ring-apricot',
              selected === label
                ? 'border-apricot bg-white shadow-card'
                : 'border-custard/40 bg-white/50 hover:bg-white',
            )}
          >
            <div className="flex h-16 items-center justify-center">
              <SobaBear
                pose={pose}
                className={pose === 'thinking' ? 'w-12' : 'w-16'}
              />
            </div>
            <span className="text-sm font-medium capitalize text-brown-dark">
              {words(label)}
            </span>
          </button>
        ))}
      </div>
      <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PrivacyNote>
          Check-ins are private. Guardians only see what you choose to share.
        </PrivacyNote>
        <Button
          type="button"
          disabled={!selected}
          loading={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api('/v1/mood-entries', {
                method: 'POST',
                body: {
                  label: selected,
                  occurred_at: new Date().toISOString(),
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
              })
              setSelected(null)
              onSaved()
            }, 'Check-in saved.')
          }
        >
          Save check-in
        </Button>
      </div>
      <div className="relative mt-3">
        <Feedback {...action} />
      </div>
    </Card>
  )
}
