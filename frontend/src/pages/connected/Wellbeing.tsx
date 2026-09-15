import { trendRange } from '../../api/dates'
import { useState } from 'react'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Field'
import { CheckIn } from './CheckIn'
import { TrendChart } from './TrendChart'
import { Badge } from '../../components/ui/Badge'
import { NotebookPen } from 'lucide-react'
import { EmptyState, PrivacyNote } from '../../components/ui/Feedback'
import { api } from '../../api/client'
import type {
  MoodEntry,
  Journal,
  Memory,
  Preferences,
  Trends,
  ContentItem,
} from '../../api/schema'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { Screen, Panel, Field, Feedback, RemoteState } from './shared'
import { inputClass, useRemote, useAction, date, words } from './state'

export function MoodPage() {
  const remote = useRemote<MoodEntry[]>('/v1/mood-entries', true)
  const trend = useRemote<Trends>(`/v1/mood-trends?${trendRange()}`)
  const action = useAction()
  return (
    <Screen
      title="Mood patterns"
      description="Your own check-ins. These labels are not a clinical score."
    >
      <CheckIn
        onSaved={() => {
          remote.reload()
          trend.reload()
        }}
      />
      <Panel>
        <h2 className="text-[17px] font-semibold text-brown-dark">
          Mood overview
        </h2>
        <RemoteState remote={trend} />
        {trend.value && <TrendChart value={trend.value} />}
        <PrivacyNote>
          Counts of recorded labels, not a clinical score.
        </PrivacyNote>
      </Panel>
      <Panel>
        <h2 className="text-xl font-semibold">Your history</h2>
        <RemoteState remote={remote} empty={!remote.value?.length} />
        {remote.value?.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-4 border-b border-line py-3"
          >
            <div>
              <p className="capitalize">{words(m.label)}</p>
              <p className="text-sm text-ink-secondary">
                {date(m.occurred_at)} · {words(m.source)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={action.busy}
              onClick={() => {
                if (window.confirm('Delete this check-in?'))
                  void action.run(async () => {
                    await api(`/v1/mood-entries/${m.id}`, { method: 'DELETE' })
                    remote.reload()
                    trend.reload()
                  }, 'Deleted.')
              }}
            >
              Delete
            </Button>
          </div>
        ))}
      </Panel>
    </Screen>
  )
}
export function JournalPage() {
  const remote = useRemote<Journal[]>('/v1/journals', true)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string | null>(null)
  const entries = remote.value?.filter((e) =>
    `${e.topic} ${e.reflection}`.toLowerCase().includes(query.toLowerCase()),
  )
  const selected = remote.value?.find((e) => e.id === active)
  return (
    <Screen
      title="Your journal"
      description="A private space for the reflections you choose to keep."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          aria-label="Search reflections"
          placeholder="Search your reflections"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ButtonLink to="/app/user/soba" variant="secondary">
          Start a conversation
        </ButtonLink>
      </div>
      <RemoteState remote={remote} />
      {entries?.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title={query ? 'No matching reflections' : 'Your story starts here'}
          description="Reflections appear after you review and save a conversation."
        />
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {entries?.map((entry) => (
          <button
            type="button"
            className="text-left"
            key={entry.id}
            onClick={() => setActive(entry.id)}
          >
            <Card
              interactive
              padding="lg"
              className="flex h-full flex-col gap-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-ink-muted">
                  {date(entry.created_at)}
                </span>
                <Badge tone="cream">Private</Badge>
              </div>
              <h2 className="font-serif text-2xl text-brown-dark">
                {entry.topic}
              </h2>
              <p className="line-clamp-3 text-sm leading-relaxed text-ink-secondary">
                {entry.reflection}
              </p>
              <span className="mt-auto text-sm font-medium text-brown">
                Open reflection →
              </span>
            </Card>
          </button>
        ))}
      </div>
      <Modal
        open={!!selected}
        onClose={() => setActive(null)}
        title="Your reflection"
      >
        {selected && (
          <JournalCard
            key={`${selected.id}:${selected.version}`}
            entry={selected}
            reload={remote.reload}
          />
        )}
      </Modal>
    </Screen>
  )
}

function JournalCard({
  entry,
  reload,
}: {
  entry: Journal
  reload: () => void
}) {
  const action = useAction()
  const [topic, setTopic] = useState(entry.topic)
  const [reflection, setReflection] = useState(entry.reflection)
  return (
    <Panel>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(async () => {
            await api(`/v1/journals/${entry.id}`, {
              method: 'PATCH',
              body: {
                topic,
                reflection,
                insights: entry.insights,
                version: entry.version,
              },
            })
            reload()
          })
        }}
      >
        <p className="text-sm text-ink-secondary">{date(entry.created_at)}</p>
        <Field label="Topic">
          <input
            className={inputClass}
            maxLength={160}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
        <Field label="Reflection">
          <textarea
            className={inputClass}
            rows={5}
            maxLength={3000}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
          />
        </Field>
        {entry.insights.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
        <div className="flex gap-3">
          <Button type="submit" loading={action.busy}>
            Save changes
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={action.busy}
            onClick={() => {
              if (window.confirm('Delete this reflection?'))
                void action.run(async () => {
                  await api(`/v1/journals/${entry.id}`, { method: 'DELETE' })
                  reload()
                }, 'Deleted.')
            }}
          >
            Delete
          </Button>
        </div>
        <Feedback {...action} />
      </form>
    </Panel>
  )
}
export function PersonalizationPage() {
  const remote = useRemote<Preferences>('/v1/me/preferences')
  const memory = useRemote<Memory[]>('/v1/memories', true)
  const action = useAction()
  const [text, setText] = useState('')
  const [category, setCategory] = useState<Memory['category']>('preference')
  return (
    <Screen
      title="Personalization"
      description="Choose how SOBA responds and which memories you keep."
    >
      <RemoteState remote={remote} />
      <div className="grid items-start gap-5 xl:grid-cols-[1.25fr_1fr]">
        {remote.value && (
          <PreferenceForm
            key={remote.value.version}
            value={remote.value}
            reload={remote.reload}
          />
        )}
        <Panel>
          <h2 className="text-xl font-semibold">Approved memories</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void action.run(async () => {
                await api('/v1/memories', {
                  method: 'POST',
                  body: { text, category },
                })
                setText('')
                memory.reload()
              })
            }}
          >
            <Field label="Memory">
              <textarea
                className={inputClass}
                required
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <Field label="Category">
              <select
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
              >
                {['preference', 'person', 'event', 'goal'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Button type="submit" loading={action.busy}>
              Add memory
            </Button>
            <Feedback {...action} />
          </form>
          <RemoteState remote={memory} empty={!memory.value?.length} />
          {memory.value?.map((m) => (
            <MemoryCard
              key={`${m.id}:${m.version}`}
              memory={m}
              reload={memory.reload}
            />
          ))}
        </Panel>
      </div>
    </Screen>
  )
}
function MemoryCard({
  memory,
  reload,
}: {
  memory: Memory
  reload: () => void
}) {
  const [text, setText] = useState(memory.text)
  const action = useAction()
  return (
    <form
      className="space-y-3 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run(async () => {
          await api(`/v1/memories/${memory.id}`, {
            method: 'PATCH',
            body: { text, category: memory.category, version: memory.version },
          })
          reload()
        })
      }}
    >
      <Field label={words(memory.category)}>
        <textarea
          className={inputClass}
          required
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Button type="submit" loading={action.busy}>
        Save memory
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={action.busy}
        onClick={() => {
          if (window.confirm('Delete this memory?'))
            void action.run(async () => {
              await api(`/v1/memories/${memory.id}`, { method: 'DELETE' })
              reload()
            }, 'Deleted.')
        }}
      >
        Delete
      </Button>
      <Feedback {...action} />
    </form>
  )
}
function PreferenceForm({
  value,
  reload,
}: {
  value: Preferences
  reload: () => void
}) {
  const [form, setForm] = useState(value)
  const action = useAction()
  return (
    <Panel>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(async () => {
            await api('/v1/me/preferences', { method: 'PUT', body: form })
            reload()
          })
        }}
      >
        <fieldset className="space-y-3">
          <legend className="text-[17px] font-semibold text-brown-dark">
            Personality
          </legend>
          <p className="text-sm text-ink-secondary">
            Choose the tone that feels right for you.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['calm', 'friendly', 'encouraging'] as const).map(
              (personality) => (
                <label
                  key={personality}
                  className={`cursor-pointer rounded-2xl border p-4 ${form.personality === personality ? 'border-apricot bg-cream' : 'border-line bg-surface'}`}
                >
                  <input
                    className="mr-2 accent-brown"
                    type="radio"
                    name="personality"
                    value={personality}
                    checked={form.personality === personality}
                    onChange={() => setForm({ ...form, personality })}
                  />
                  <span className="text-sm font-semibold capitalize">
                    {personality}
                  </span>
                </label>
              ),
            )}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-[17px] font-semibold text-brown-dark">
            Voice
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['marin', 'cedar'] as const).map((voice) => (
              <label
                key={voice}
                className={`cursor-pointer rounded-2xl border p-5 ${form.voice === voice ? 'border-apricot bg-cream' : 'border-line bg-surface'}`}
              >
                <input
                  className="mr-2 accent-brown"
                  type="radio"
                  name="voice"
                  value={voice}
                  checked={form.voice === voice}
                  onChange={() => setForm({ ...form, voice })}
                />
                <span className="font-semibold">{voice === 'marin' ? 'Soft voice' : 'Deep voice'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={form.listen_first}
            onChange={(e) =>
              setForm({ ...form, listen_first: e.target.checked })
            }
          />
          Listen first
        </label>
        <label className="flex gap-3">
          <input
            type="checkbox"
            checked={form.memory_enabled}
            onChange={(e) =>
              setForm({ ...form, memory_enabled: e.target.checked })
            }
          />
          Use approved memories
        </label>
        <label className="flex gap-3">
          <input type="checkbox" checked={form.mood_history_enabled ?? false}
            onChange={(e) => setForm({ ...form, mood_history_enabled: e.target.checked })} />
          Use my mood history in Personal mode
        </label>
        <p className="text-sm text-ink-secondary">SOBA can use up to seven check-ins from the past week. Private mode excludes them. Your mood entries are never changed by the AI.</p>
        <Button type="submit" loading={action.busy}>
          Save preferences
        </Button>
        <Feedback {...action} />
      </form>
    </Panel>
  )
}
export function ContentPage({ coach = false }: { coach?: boolean }) {
  const { profile } = useAuth()
  const remote = useRemote<ContentItem[]>(
    `${coach ? '/v1/parent-coach' : '/v1/toolkit'}?locale=${profile?.locale ?? 'en-US'}`,
    true,
  )
  return (
    <Screen
      title={coach ? 'Parent coach' : 'Your toolkit'}
      description="Content reviewed for this service. If no content is available, it will appear after the team publishes it."
    >
      <RemoteState remote={remote} empty={!remote.value?.length} />
      {remote.value?.map((c) => (
        <Panel key={c.id}>
          <h2 className="text-xl font-semibold">{c.title}</h2>
          <p className="text-sm text-ink-secondary">
            {words(c.kind)} · {c.locale}
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            {c.steps.map((s, i) => (
              <li key={i}>
                {s.text}
                {s.duration_seconds > 0 && (
                  <span className="block text-sm text-ink-secondary">
                    {s.duration_seconds} seconds
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Panel>
      ))}
    </Screen>
  )
}
