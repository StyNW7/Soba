import { useState } from 'react'
import {
  Brain,
  Download,
  LockKeyhole,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { AlertCard, EmptyState, PageHeader } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import type { MemoryItem } from '../../types'

const categoryOptions = [
  { value: 'context', label: 'Context' },
  { value: 'preference', label: 'Preference' },
  { value: 'routine', label: 'Routine' },
]

export default function Privacy() {
  const { memory, addMemory, updateMemory, removeMemory, privacy, updatePrivacy, resetDemoData } =
    useAppData()
  const { toast } = useToast()

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<MemoryItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [category, setCategory] = useState<MemoryItem['category']>('context')

  return (
    <>
      <PageHeader
        title="Memory & Privacy"
        description="Everything Soba holds about you, and the controls to change or remove it."
      />

      <Card tone="cream" padding="lg" className="mb-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-brown-dark">
              Guardians cannot read your private conversations by default.
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              What a guardian sees is limited to wellbeing direction and safety signals. Journals,
              transcripts, and the memories below are never included.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <SectionCard
            title="Conversation memory"
            description="Whether Soba may carry context between conversations."
            icon={<Brain className="h-[18px] w-[18px]" />}
          >
            <Toggle
              checked={privacy.rememberContext}
              onChange={(value) => {
                updatePrivacy({ rememberContext: value })
                toast(value ? 'Soba will remember context' : 'Soba will start each conversation fresh', {
                  tone: 'info',
                })
              }}
              label="Allow Soba to remember context"
              description="When off, every conversation starts with no history. Saved memories are kept but not used."
            />
          </SectionCard>

          <SectionCard
            title="Saved memories"
            description="Facts Soba may use. You approved each one."
            action={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add
              </Button>
            }
          >
            {memory.length === 0 ? (
              <EmptyState
                icon={Brain}
                title="No saved memories"
                description="Anything Soba remembers about you would appear here, and only after you approve it."
              />
            ) : (
              <ul className="space-y-3">
                {memory.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-muted/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-brown-dark">{item.text}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge tone="cream" className="capitalize">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-ink-muted">Added {item.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(item)
                          setDraft(item.text)
                        }}
                        aria-label={`Edit memory: ${item.text}`}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeMemory(item.id)
                          toast('Memory deleted', { tone: 'info' })
                        }}
                        aria-label={`Delete memory: ${item.text}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Conversation data"
            description="What is kept after a conversation ends."
            icon={<LockKeyhole className="h-[18px] w-[18px]" />}
          >
            <div className="space-y-5">
              <Toggle
                checked={privacy.storeSummaries}
                onChange={(value) => updatePrivacy({ storeSummaries: value })}
                label="Store reflection summaries"
                description="Short summaries you review and approve at the end of a conversation."
              />
              <Toggle
                checked={privacy.storeTranscripts}
                onChange={(value) => updatePrivacy({ storeTranscripts: value })}
                label="Store raw transcripts"
                description="The full text of what was said. Off by default."
              />
              <div className="rounded-2xl border border-amber/30 bg-amber-soft/50 p-4">
                <Toggle
                  checked={privacy.storeRawAudio}
                  onChange={(value) => {
                    updatePrivacy({ storeRawAudio: value })
                    if (value) {
                      toast('Raw audio storage enabled', {
                        tone: 'warning',
                        description: 'You can turn this off again at any time.',
                      })
                    }
                  }}
                  label="Store raw audio"
                  description="Recordings of your voice. Off by default, and rarely necessary. Turning this on stores audio until you delete it."
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Sharing"
            description="What a guardian in your circle can see."
            icon={<ShieldCheck className="h-[18px] w-[18px]" />}
          >
            <div className="space-y-5">
              <Toggle
                checked={privacy.shareMoodTrend}
                onChange={(value) => updatePrivacy({ shareMoodTrend: value })}
                label="Share mood direction"
                description="An aggregated view of how the week has gone. No entries, topics, or notes."
                tone="sage"
              />
              <Toggle
                checked={privacy.shareSafetyAlerts}
                onChange={(value) => updatePrivacy({ shareSafetyAlerts: value })}
                label="Share safety alerts"
                description="If Soba detects a serious wellbeing signal, a guardian is told a check-in is recommended. What you said is never included."
                tone="sage"
              />

              <ul className="space-y-2.5 border-t border-line pt-5 text-sm">
                {['Conversation transcripts', 'Journal entries', 'Saved memories'].map((item) => (
                  <li key={item} className="flex items-center justify-between gap-3">
                    <span className="text-ink-secondary">{item}</span>
                    <Badge tone="neutral" icon={<LockKeyhole className="h-3 w-3" />}>
                      Never shared
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard title="Export your data" description="Take a full copy of everything Soba holds.">
            <Button
              variant="secondary"
              fullWidth
              onClick={() =>
                toast('Export requested', {
                  description: 'You will be notified when the file is ready to download.',
                })
              }
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Request export
            </Button>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Includes reflections, mood entries, memories, and settings in a portable format.
            </p>
          </SectionCard>

          <AlertCard tone="urgent" title="Delete my data" icon={TriangleAlert}>
            <p className="mb-4">
              This permanently removes your reflections, mood history, memories, and device pairing.
              It cannot be undone.
            </p>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete my data
            </Button>
          </AlertCard>
        </div>
      </div>

      {/* Add memory */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a memory"
        description="Something you would like Soba to keep in mind."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!draft.trim()}
              onClick={() => {
                addMemory(draft.trim(), category)
                setDraft('')
                setAddOpen(false)
                toast('Memory saved')
              }}
            >
              Save memory
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Memory"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Prefers to be listened to before receiving suggestions"
            maxLength={500}
            data-autofocus
          />
          <Select
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={(event) => setCategory(event.target.value as MemoryItem['category'])}
          />
        </div>
      </Modal>

      {/* Edit memory */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit memory"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editing) return
                updateMemory(editing.id, draft.trim())
                setEditing(null)
                toast('Memory updated')
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <Input
          label="Memory"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          data-autofocus
        />
      </Modal>

      {/* Delete */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete everything?"
        description="This removes all reflections, mood entries, memories, and settings from this device."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep my data
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemoData()
                setDeleteOpen(false)
                toast('Data reset', { tone: 'warning', description: 'Demo data has been restored to its starting state.' })
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          In this demo, deleting restores the sample data to its starting state so you can explore
          the flow again. In the real product this action is irreversible and a deletion receipt is
          issued.
        </p>
      </Modal>
    </>
  )
}
