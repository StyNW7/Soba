import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeartHandshake,
  Mic,
  MicOff,
  PhoneCall,
  Send,
  ShieldCheck,
  Square,
  Stethoscope,
  TriangleAlert,
  Wind,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/Feedback'
import { Modal } from '../../components/ui/Modal'
import { VoiceOrb } from '../../components/voice/VoiceOrb'
import type { VoiceState } from '../../components/voice/VoiceOrb'
import { cn } from '../../lib/cn'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import {
  conversationSeed,
  pastSessions,
  safetyResponse,
  safetyTriggerPhrase,
  sobaReplies,
  suggestedPrompts,
} from '../../data/mockConversation'
import type { ConversationTurn } from '../../types'

const riskMarkers = [
  'do not want to be here',
  "don't want to be here",
  'want to die',
  'end my life',
  'hurt myself',
  'no reason to go on',
]

function looksSerious(text: string) {
  const normalized = text.toLowerCase()
  return riskMarkers.some((marker) => normalized.includes(marker))
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function TalkToSoba() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { safetyModeActive, triggerSafetyEscalation, clearSafetyEscalation, addJournal } = useAppData()

  const [turns, setTurns] = useState<ConversationTurn[]>(conversationSeed)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [micOn, setMicOn] = useState(true)
  const [draft, setDraft] = useState('')
  const [ended, setEnded] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, voiceState])

  useEffect(() => () => clearSafetyEscalation(), [clearSafetyEscalation])

  function send(text: string) {
    const value = text.trim()
    if (!value || ended) return
    setDraft('')

    const userTurn: ConversationTurn = {
      id: `u_${Date.now()}`,
      speaker: 'user',
      text: value,
      time: nowLabel(),
    }
    setTurns((current) => [...current, userTurn])

    const serious = looksSerious(value)
    setVoiceState('thinking')

    window.setTimeout(() => {
      setVoiceState('speaking')
      if (serious) {
        triggerSafetyEscalation()
        setTurns((current) => [
          ...current,
          {
            id: `s_${Date.now()}`,
            speaker: 'soba',
            text: safetyResponse,
            time: nowLabel(),
            mode: 'safety',
          },
        ])
        toast('Soba moved into Safety Mode', {
          tone: 'warning',
          description: 'A guardian check-in has been recommended. Your words were not shared.',
        })
      } else {
        const reply = sobaReplies[Math.floor(Math.random() * sobaReplies.length)]
        setTurns((current) => [
          ...current,
          { id: `s_${Date.now()}`, speaker: 'soba', text: reply, time: nowLabel() },
        ])
      }
      window.setTimeout(() => setVoiceState(micOn ? 'listening' : 'idle'), 1600)
    }, 1100)
  }

  function handleEndSession() {
    setEnded(true)
    setVoiceState('idle')
    setSaveOpen(true)
  }

  function handleSaveReflection() {
    const spoken = turns.filter((turn) => turn.speaker === 'user').map((turn) => turn.text)
    addJournal({
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isoDate: new Date().toISOString().slice(0, 10),
      title: spoken[0]?.slice(0, 60) ?? 'Voice conversation',
      summary: 'A short summary of what you talked about, saved because you chose to keep it.',
      body: spoken.join(' '),
      mood: safetyModeActive ? 'Overwhelmed' : 'Okay',
      source: 'voice',
      insights: [],
    })
    setSaveOpen(false)
    toast('Reflection saved', { description: 'Only you can see this reflection.' })
    navigate('/app/user/journal')
  }

  return (
    <>
      <PageHeader
        title="Talk to Soba"
        description="Speak naturally. You can stop at any time, and nothing is saved unless you choose to keep it."
        action={
          <Badge tone={safetyModeActive ? 'terracotta' : 'sage'} size="md" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            {safetyModeActive ? 'Safety Mode' : 'Private session'}
          </Badge>
        }
      />

      {safetyModeActive ? (
        <div className="mb-6 rounded-3xl border border-terracotta/30 bg-terracotta-soft p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-dark" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-terracotta-dark sm:text-lg">
                  Let&rsquo;s focus on keeping you supported.
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-terracotta-dark/85">
                  Soba is not the right support on its own for what you just said. Reaching a person
                  is the better next step, and Soba can help you do that now.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row lg:shrink-0">
              <Button variant="danger" onClick={() => navigate('/app/user/circle')}>
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                Contact trusted person
              </Button>
              <Button variant="secondary" onClick={() => navigate('/app/user/support')}>
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
                Get professional support
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        {/* Voice stage */}
        <Card
          padding="lg"
          className={cn(
            'flex flex-col items-center justify-center transition-colors duration-500',
            safetyModeActive ? 'bg-terracotta-soft/40 border-terracotta/25' : 'bg-cream/60',
          )}
        >
          <VoiceOrb state={voiceState} safetyMode={safetyModeActive} size={250} />

          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {ended
              ? 'Session ended'
              : voiceState === 'idle'
                ? 'Ready when you are'
                : voiceState === 'listening'
                  ? 'Listening'
                  : voiceState === 'thinking'
                    ? 'Thinking'
                    : 'Speaking'}
          </p>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-ink-secondary">
            {ended
              ? 'You can save a reflection from this conversation, or leave it unsaved.'
              : 'Start wherever you want. There is no right way to begin.'}
          </p>

          {/* Controls */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            <Button
              variant={micOn ? 'primary' : 'secondary'}
              size="lg"
              onClick={() => {
                const next = !micOn
                setMicOn(next)
                setVoiceState(next ? 'listening' : 'idle')
              }}
              disabled={ended}
              aria-pressed={micOn}
            >
              {micOn ? <Mic className="h-4 w-4" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
              {micOn ? 'Mic on' : 'Mic off'}
            </Button>
            <Button variant="outline" size="lg" onClick={handleEndSession} disabled={ended}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              End session
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/user/toolkit')}>
              <Wind className="h-4 w-4" aria-hidden="true" />
              Grounding
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate('/app/user/circle')}>
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              Contact someone
            </Button>
          </div>

          <p className="mt-8 flex items-start gap-2 rounded-2xl bg-surface/80 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-sage" aria-hidden="true" />
            This session is private. Raw audio is not stored, and nothing is saved unless you choose
            to keep it at the end.
          </p>
        </Card>

        {/* Transcript */}
        <Card padding="none" className="flex min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-brown-dark">Live transcript</h2>
            <span className="text-xs text-ink-muted">{turns.length} messages</span>
          </div>

          <div ref={transcriptRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={cn('flex flex-col gap-1', turn.speaker === 'user' ? 'items-end' : 'items-start')}
              >
                <span className="px-1 text-[11px] font-medium text-ink-muted">
                  {turn.speaker === 'user' ? 'You' : 'Soba'} · {turn.time}
                </span>
                <div
                  className={cn(
                    'max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    turn.speaker === 'user'
                      ? 'rounded-tr-md bg-brown text-cream'
                      : turn.mode === 'safety'
                        ? 'rounded-tl-md border border-terracotta/25 bg-terracotta-soft text-terracotta-dark'
                        : 'rounded-tl-md bg-cream text-brown-dark',
                  )}
                >
                  {turn.text}
                </div>
              </div>
            ))}

            {voiceState === 'thinking' ? (
              <div className="flex items-center gap-2 px-1 text-xs text-ink-muted">
                <span className="flex gap-1">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="h-1.5 w-1.5 animate-breathe rounded-full bg-brown-soft"
                      style={{ animationDelay: `${index * 180}ms` }}
                    />
                  ))}
                </span>
                Soba is thinking
              </div>
            ) : null}
          </div>

          {/* Suggested prompts */}
          {!ended ? (
            <div className="border-t border-line px-5 py-4">
              <p className="text-xs font-medium text-ink-muted">Not sure where to start?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {suggestedPrompts.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="rounded-full border border-line bg-cream/60 px-3 py-1.5 text-xs text-brown-dark transition hover:border-apricot/50 hover:bg-cream"
                  >
                    {prompt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => send(safetyTriggerPhrase)}
                  className="rounded-full border border-terracotta/30 bg-terracotta-soft px-3 py-1.5 text-xs font-medium text-terracotta-dark transition hover:bg-terracotta-soft/80"
                  title="Demonstrates how Soba escalates a serious wellbeing signal"
                >
                  Demo: serious signal
                </button>
              </div>

              <form
                className="mt-4 flex items-end gap-2.5"
                onSubmit={(event) => {
                  event.preventDefault()
                  send(draft)
                }}
              >
                <label htmlFor="soba-input" className="sr-only">
                  Type instead of speaking
                </label>
                <input
                  id="soba-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Or type instead of speaking"
                  className="h-11 flex-1 rounded-2xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-muted focus:border-apricot focus:outline-none focus:ring-2 focus:ring-apricot/25"
                />
                <Button type="submit" size="md" disabled={!draft.trim()} aria-label="Send message">
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </div>
          ) : (
            <div className="border-t border-line px-5 py-4">
              <Button fullWidth onClick={() => setSaveOpen(true)}>
                Review this conversation
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Past sessions */}
      <Card padding="lg" className="mt-5">
        <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Recent sessions</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Only sessions you chose to keep appear in your journal.
        </p>
        <ul className="mt-5 divide-y divide-line">
          {pastSessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-brown-dark">{session.title}</p>
                <p className="text-xs text-ink-muted">
                  {session.date} · {session.duration}
                </p>
              </div>
              <Badge tone={session.saved ? 'cream' : 'neutral'}>
                {session.saved ? 'Reflection saved' : 'Not saved'}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Keep a reflection from this conversation?"
        description="Nothing has been saved yet. You decide what stays."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Discard
            </Button>
            <Button onClick={handleSaveReflection} data-autofocus>
              Save reflection
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-cream p-4">
            <p className="text-xs font-medium text-ink-muted">Suggested summary</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-dark">
              A short summary of what you talked about, saved because you chose to keep it.
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Raw audio is not stored. If you discard this, the conversation is not kept anywhere.
          </p>
          <p className="inline-flex items-start gap-2 rounded-2xl bg-sage-soft px-3.5 py-2.5 text-xs leading-relaxed text-[#4A5C40]">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Only you can see saved reflections. Guardians never receive them.
          </p>
        </div>
      </Modal>
    </>
  )
}
