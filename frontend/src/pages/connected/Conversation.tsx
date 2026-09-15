import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { Session, Draft, SaveSelection } from '../../api/schema'
import { WakeWordListener } from '../../api/wake-word'
import { VoiceConnection } from '../../api/voice'
import type { VoiceState } from '../../api/voice'
import { VoiceOrb } from '../../components/voice/VoiceOrb'
import { Button } from '../../components/ui/Button'
import { Screen, Panel, Field, Feedback, RemoteState } from './shared'
import { inputClass, useRemote, useAction, date, words, moods } from './state'
import { SafetyPlanPanel } from './Account'

export function ConversationPage() {
  const remote = useRemote<Session[]>('/v1/sessions', true)
  const [state, setState] = useState<VoiceState>('closed')
  const wakeListener = useRef<WakeWordListener | null>(null)
  const [wakeStatus, setWakeStatus] = useState('')
  const [wakeEnabled, setWakeEnabled] = useState(false)
  const [muted, setMuted] = useState(false)
  const [message, setMessage] = useState('')
  const [transcript, setTranscript] = useState('')
  const [mode, setMode] = useState<'personal' | 'private'>('personal')
  const connection = useRef<VoiceConnection | null>(null)
  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) {
        wakeListener.current?.stop()
        setWakeEnabled(false)
        setWakeStatus('Wake-word listening is off while this page is hidden.')
      }
    }
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden)
      wakeListener.current?.stop()
      connection.current?.close()
    }
  }, [])
  useEffect(() => {
    if (!wakeEnabled || !['closed', 'review'].includes(state)) return
    const listener = new WakeWordListener()
    wakeListener.current = listener
    setWakeStatus('Preparing local listening…')
    void listener.start(start, setWakeStatus, () => setWakeEnabled(false)).catch((error) => {
      listener.stop()
      setWakeEnabled(false)
      setWakeStatus(error instanceof Error ? error.message : 'Local listening could not start.')
    })
    return () => listener.stop()
  }, [wakeEnabled, state, mode])
  function start() {
    if (connection.current && state !== 'closed' && state !== 'review') return
    connection.current?.close()
    wakeListener.current?.stop()
    setWakeStatus('')
    setMuted(false)
    setState('connecting')
    setMessage('')
    setTranscript('')
    const voice = new VoiceConnection(
      (next, text) => {
        setState(next)
        if (text) setMessage(text)
      },
      setTranscript,
      remote.reload,
    )
    connection.current = voice
    void voice.start(mode)
  }
  const active = !['closed', 'review'].includes(state)
  return (
    <Screen
      title="Talk to SOBA"
      description="Voice is processed by the configured speech providers. Nothing is saved until you review it."
    >
      <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Panel>
          <div className="flex justify-center py-4">
            <VoiceOrb
              size={220}
              state={
                state === 'recording'
                  ? 'listening'
                  : state === 'speaking'
                    ? 'speaking'
                    : state === 'connecting' ||
                        state === 'finishing' ||
                        state === 'processing'
                      ? 'thinking'
                      : 'idle'
              }
            />
          </div>
          <Field label="Conversation mode">
            <select
              className={inputClass}
              disabled={active}
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="personal">
                Personal — use approved memories, review before saving
              </option>
              <option value="private">Private — no saved review</option>
            </select>
          </Field>
          <p role="status">{muted && active ? 'Microphone muted' : state === 'recording' ? 'Listening — speak naturally' : words(state)}</p>
          <p>Start once, then talk naturally. SOBA listens again after each reply. A minute without speech ends the session.</p>
          {message && <p role="status">{message}</p>}
          {transcript && <p className="whitespace-pre-wrap">{transcript}</p>}
          {!active && (
            <div className="space-y-2">
              <Button type="button" aria-pressed={wakeEnabled} onClick={() => {
                if (wakeEnabled) {
                  wakeListener.current?.stop()
                  setWakeEnabled(false)
                  setWakeStatus('Wake-word listening is off.')
                } else { setWakeEnabled(true) }
              }}>{wakeEnabled ? 'Disable Hey Soba' : 'Enable Hey Soba'}</Button>
              <p className="text-sm">Idle audio stays on this device. Say “Hey Soba”, then wait for Listening before you speak. Requires local speech support and microphone permission.</p>
              {wakeStatus && <p role="status">{wakeStatus}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!active && (
              <Button type="button" onClick={start}>
                Start voice session
              </Button>
            )}
            {active && state !== 'connecting' && state !== 'finishing' && (
              <Button
                type="button"
                aria-pressed={muted}
                onClick={() => {
                  connection.current?.setMuted(!muted)
                  setMuted(!muted)
                }}
              >
                {muted ? 'Unmute microphone' : 'Mute microphone'}
              </Button>
            )}
            {state === 'ready' && connection.current?.canReplay() && (
              <Button type="button" variant="secondary" onClick={() => void connection.current?.replay()}>
                Play reply again
              </Button>
            )}
            {state === 'recording' && (
              <Button
                type="button"
                onClick={() => connection.current?.endTurn()}
              >
                Finish speaking
              </Button>
            )}
            {active && state !== 'connecting' && state !== 'finishing' && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => connection.current?.finish()}
              >
                End and review
              </Button>
            )}
            {active && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  connection.current?.close()
                  setState('closed')
                  setMessage('Stopped. Unsaved voice content was not saved.')
                  setTranscript('')
                }}
              >
                Stop now
              </Button>
            )}
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Conversations to review</h2>
          <Button type="button" variant="ghost" onClick={remote.reload}>
            Refresh reviews
          </Button>
          <RemoteState remote={remote} empty={!remote.value?.length} />
          {remote.value?.map((s) => (
            <ReviewSession key={s.id} session={s} reload={remote.reload} />
          ))}
        </Panel>
      </div>
      <SafetyPlanPanel />
    </Screen>
  )
}
function ReviewSession({
  session,
  reload,
}: {
  session: Session
  reload: () => void
}) {
  const [opened, setOpened] = useState(false)
  const remote = useRemote<Draft>(
    opened ? `/v1/sessions/${session.id}/draft` : null,
  )
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p>
        {date(session.started_at)} · {session.state}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpened(!opened)}
      >
        {opened ? 'Close review' : 'Review conversation'}
      </Button>
      {opened && (
        <>
          <RemoteState remote={remote} />
          {remote.value && <DraftForm draft={remote.value} reload={reload} />}
        </>
      )}
    </div>
  )
}
function DraftForm({ draft, reload }: { draft: Draft; reload: () => void }) {
  const action = useAction()
  const [selection, setSelection] = useState<SaveSelection>({
    version: draft.version,
    save_journal: false,
    save_mood: false,
    mood: draft.mood,
    memory_candidate_ids: [],
  })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run(async () => {
          await api(`/v1/sessions/${draft.session_id}/save`, {
            method: 'POST',
            body: selection,
          })
          reload()
        }, 'Your selection was saved.')
      }}
    >
      <h3 className="text-xl font-semibold">{draft.topic}</h3>
      <p className="whitespace-pre-wrap">{draft.reflection}</p>
      {draft.insights.map((s, i) => (
        <p key={i}>{s}</p>
      ))}
      <p className="text-sm">Review expires {date(draft.expires_at)}</p>
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={selection.save_journal}
          onChange={(e) =>
            setSelection({ ...selection, save_journal: e.target.checked })
          }
        />
        Save reflection to journal
      </label>
      <label className="flex gap-3">
        <input
          type="checkbox"
          checked={selection.save_mood}
          onChange={(e) =>
            setSelection({ ...selection, save_mood: e.target.checked })
          }
        />
        Save mood
      </label>
      <Field label="Mood">
        <select
          className={inputClass}
          value={selection.mood}
          onChange={(e) =>
            setSelection({
              ...selection,
              mood: e.target.value as typeof selection.mood,
            })
          }
        >
          {moods.map((m) => (
            <option key={m} value={m}>
              {words(m)}
            </option>
          ))}
        </select>
      </Field>
      {draft.memories.map((m) => (
        <label key={m.id} className="flex gap-3">
          <input
            type="checkbox"
            checked={selection.memory_candidate_ids.includes(m.id)}
            onChange={(e) =>
              setSelection({
                ...selection,
                memory_candidate_ids: e.target.checked
                  ? [...selection.memory_candidate_ids, m.id]
                  : selection.memory_candidate_ids.filter((id) => id !== m.id),
              })
            }
          />
          {m.text}
        </label>
      ))}
      <div className="flex gap-3">
        <Button type="submit" loading={action.busy}>
          Save selected items
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={action.busy}
          onClick={() => {
            if (window.confirm('Discard this review?'))
              void action.run(async () => {
                await api(`/v1/sessions/${draft.session_id}/draft`, {
                  method: 'DELETE',
                })
                reload()
              }, 'Review discarded.')
          }}
        >
          Discard
        </Button>
      </div>
      <Feedback {...action} />
    </form>
  )
}
