import { useMemo, useState } from 'react'
import { LockKeyhole, Mic, NotebookPen, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/Feedback'
import { EmptyState } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { MoodIcon } from '../../components/ui/Brand'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import type { JournalEntry, MoodLabel } from '../../types'

type Filter = 'all' | 'voice' | 'written'

const moodOptions = [
  { value: 'Calm', label: 'Calm' },
  { value: 'Okay', label: 'Okay' },
  { value: 'Tired', label: 'Tired' },
  { value: 'Stressed', label: 'Stressed' },
  { value: 'Overwhelmed', label: 'Overwhelmed' },
]

export default function Journal() {
  const { journal, addJournal, removeJournal } = useAppData()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [active, setActive] = useState<JournalEntry | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mood, setMood] = useState<MoodLabel>('Okay')

  const entries = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return journal.filter((entry) => {
      const matchesFilter = filter === 'all' || entry.source === filter
      const matchesQuery =
        !normalized ||
        entry.title.toLowerCase().includes(normalized) ||
        entry.summary.toLowerCase().includes(normalized)
      return matchesFilter && matchesQuery
    })
  }, [journal, query, filter])

  function handleCreate() {
    if (!title.trim() || !body.trim()) return
    addJournal({
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isoDate: new Date().toISOString().slice(0, 10),
      title: title.trim(),
      summary: body.trim().slice(0, 160),
      body: body.trim(),
      mood,
      source: 'written',
      insights: [],
    })
    setTitle('')
    setBody('')
    setMood('Okay')
    setComposerOpen(false)
    toast('Reflection saved', { description: 'Only you can see this reflection.' })
  }

  return (
    <>
      <PageHeader
        title="Journal & Reflection"
        description="Summaries you chose to keep, and anything you have written yourself."
        action={
          <Button size="lg" onClick={() => setComposerOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New reflection
          </Button>
        }
      />

      <Card padding="md" className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-sm">
            <Input
              placeholder="Search reflections"
              icon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search reflections"
            />
          </div>
          <Tabs
            tabs={[
              { value: 'all', label: 'All', count: journal.length },
              { value: 'voice', label: 'Voice', count: journal.filter((e) => e.source === 'voice').length },
              { value: 'written', label: 'Written', count: journal.filter((e) => e.source === 'written').length },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No reflections here yet"
          description="Your reflections will appear here when you choose to save something from a conversation."
          action={
            <Button onClick={() => setComposerOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Write a reflection
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <Card key={entry.id} padding="lg" interactive className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-ink-muted">{entry.date}</span>
                <Badge tone={entry.source === 'voice' ? 'apricot' : 'cream'}>
                  {entry.source === 'voice' ? (
                    <>
                      <Mic className="h-3 w-3" aria-hidden="true" />
                      Voice
                    </>
                  ) : (
                    <>
                      <NotebookPen className="h-3 w-3" aria-hidden="true" />
                      Written
                    </>
                  )}
                </Badge>
              </div>

              <h2 className="mt-3 font-serif text-xl leading-snug text-brown-dark">{entry.title}</h2>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-secondary">{entry.summary}</p>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
                <Badge tone="neutral" icon={<MoodIcon mood={entry.mood} />}>
                  {entry.mood}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => setActive(entry)}>
                  Open
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 inline-flex items-center gap-2 text-xs text-ink-muted">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        Only you can see these reflections. They are never shared with a guardian.
      </p>

      {/* Detail */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title ?? ''}
        description={active ? `${active.date} · ${active.source === 'voice' ? 'Voice reflection' : 'Written reflection'}` : undefined}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                if (!active) return
                removeJournal(active.id)
                setActive(null)
                toast('Reflection deleted', { tone: 'info' })
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
            <Button onClick={() => setActive(null)} data-autofocus>
              Close
            </Button>
          </>
        }
      >
        {active ? (
          <div className="space-y-5">
            <Badge tone="cream" icon={<MoodIcon mood={active.mood} />}>
              {active.mood}
            </Badge>
            <p className="text-sm leading-relaxed text-ink">{active.body}</p>

            {active.insights.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-brown-dark">What you noticed</h3>
                <ul className="mt-2.5 space-y-2">
                  {active.insights.map((insight) => (
                    <li
                      key={insight}
                      className="rounded-2xl bg-cream px-4 py-3 text-sm leading-relaxed text-brown-dark"
                    >
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="inline-flex items-start gap-2 rounded-2xl bg-sage-soft px-3.5 py-2.5 text-xs leading-relaxed text-sage-deep">
              <LockKeyhole className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Only you can see this reflection.
            </p>
          </div>
        ) : null}
      </Modal>

      {/* Composer */}
      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="New reflection"
        description="Write as much or as little as you want. It stays private."
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!title.trim() || !body.trim()}>
              Save reflection
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="What is this about?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-autofocus
            maxLength={160}
          />
          <Textarea
            label="Reflection"
            placeholder="There is no structure to follow here."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={3000}
          />
          <Select
            label="How did it feel?"
            options={moodOptions}
            value={mood}
            onChange={(event) => setMood(event.target.value as MoodLabel)}
          />
        </div>
      </Modal>
    </>
  )
}
