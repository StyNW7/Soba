import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { VoiceOrb } from '../../components/voice/VoiceOrb'
import type { VoiceState } from '../../components/voice/VoiceOrb'
import { SessionReview } from '../../components/voice/SessionReview'
import { GroundingPlayer } from '../../components/voice/GroundingPlayer'
import { cn } from '../../lib/cn'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  conversationSeed,
  listeningReplies,
  pastSessions,
  riskMarkers,
  safetyResponse,
  safetyTriggerPhrase,
  suggestingReplies,
  supportMarkers,
  supportResponse,
  supportTriggerPhrase,
  suggestedPrompts,
} from '../../data/mockConversation'
import { toolkitActivities } from '../../data/mockToolkit'
import type { ConversationMode, ConversationTurn, SessionDraft } from '../../types'

function detectMode(text: string): ConversationMode {
  const normalized = text.toLowerCase()
  if (riskMarkers.some((marker) => normalized.includes(marker))) return 'safety'
  if (supportMarkers.some((marker) => normalized.includes(marker))) return 'support'
  return 'normal'
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const modeCopy: Record<ConversationMode, { label: string; detail: string }> = {
  normal: {
    label: 'Normal conversation',
    detail: 'Everyday talking and emotional sharing.',
  },
  support: {
    label: 'Support mode',
    detail: 'Soba is offering grounding and reassurance before continuing.',
  },
  safety: {
    label: 'Safety mode',
    detail: 'Soba is prioritising human support over continuing alone.',
  },
}

export default function TalkToSoba() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const {
    safetyModeActive,
    triggerSafetyEscalation,
    clearSafetyEscalation,
    addJournal,
    addMood,
    addMemory,
    personalization,
    privacy,
  } = useAppData()

  const [turns, setTurns] = useState<ConversationTurn[]>(conversationSeed)
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [mode, setMode] = useState<ConversationMode>('normal')
  const [micOn, setMicOn] = useState(true)
  const [draft, setDraft] = useState('')
  const [ended, setEnded] = useState(false)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [groundingOpen, setGroundingOpen] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const timers = useRef<number[]>([])

  const groundingActivity = useMemo(
    () => toolkitActivities.find((activity) => activity.category === 'Breathing') ?? toolkitActivities[0],
    [],
  )

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, voiceState])

  // Clear pending reply timers and any demo safety state when leaving the page.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
      clearSafetyEscalation()
    }
  }, [clearSafetyEscalation])

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay)
    timers.current.push(id)
  }, [])

  const send = useCallback(
    (text: string) => {
      const value = text.trim()
      if (!value || ended) return
      setDraft('')

      setTurns((current) => [
        ...current,
        { id: `u_${Date.now()}`, speaker: 'user', text: value, time: nowLabel() },
      ])

      const nextMode = detectMode(value)
      setVoiceState('thinking')

      schedule(() => {
        setVoiceState('speaking')

        if (nextMode === 'safety') {
          setMode('safety')
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
        } else if (nextMode === 'support') {
          setMode('support')
          setTurns((current) => [
            ...current,
            { id: `s_${Date.now()}`, speaker: 'soba', text: supportResponse, time: nowLabel() },
          ])
        } else {
          // Personalization changes which register Soba replies in (C2, C3).
          const pool = personalization.listenFirst ? listeningReplies : suggestingReplies
          const reply = pool[Math.floor(Math.random() * pool.length)]
          setTurns((current) => [
            ...current,
            { id: `s_${Date.now()}`, speaker: 'soba', text: reply, time: nowLabel() },
          ])
        }

        schedule(() => setVoiceState(micOn ? 'listening' : 'idle'), 1600)
      }, 1100)
    },
    [ended, micOn, personalization.listenFirst, schedule, toast, triggerSafetyEscalation],
  )

  const buildDraft = useCallback((): SessionDraft => {
    const spoken = turns.filter((turn) => turn.speaker === 'user').map((turn) => turn.text)
    const topic = spoken[0]?.replace(/\.$/, '') ?? 'A conversation with Soba'
    return {
      id: `draft_${Date.now()}`,
      sessionTitle: 'Voice conversation',
      mood: mode === 'safety' ? 'Overwhelmed' : mode === 'support' ? 'Stressed' : 'Okay',
      topic: topic.length > 64 ? `${topic.slice(0, 64)}…` : topic,
      reflection:
        spoken.length > 1
          ? `You talked about ${topic.toLowerCase()}, and stayed with it long enough to describe what was underneath it.`
          : 'You started a conversation and described how the day had been going.',
      insights: spoken.slice(1, 3).map((line) => (line.length > 90 ? `${line.slice(0, 90)}…` : line)),
      safetyLevel: mode === 'safety' ? 'elevated' : mode === 'support' ? 'monitor' : 'none',
      memoryCandidates: [
        { id: 'mc1', text: topic.length > 70 ? `${topic.slice(0, 70)}…` : topic, category: 'context' },
        {
          id: 'mc2',
          text: personalization.listenFirst
            ? 'Prefers to be listened to before receiving suggestions'
            : 'Finds concrete next steps helpful',
          category: 'preference',
        },
      ],
      expiresAt: Date.now() + 10 * 60 * 1000,
    }
  }, [mode, personalization.listenFirst, turns])

  function handleEndSession() {
    setEnded(true)
    setVoiceState('idle')
    setSessionDraft(buildDraft())
    setReviewOpen(true)
  }

  function handleSave({
    saveJournal,
    saveMood,
    memoryIds,
  }: {
    saveJournal: boolean
    saveMood: boolean
    memoryIds: string[]
  }) {
    if (!sessionDraft) return
    const saved: string[] = []

    if (saveJournal) {
      addJournal({
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        isoDate: new Date().toISOString().slice(0, 10),
        title: sessionDraft.topic,
        summary: sessionDraft.reflection,
        body: turns
          .filter((turn) => turn.speaker === 'user')
          .map((turn) => turn.text)
          .join(' '),
        mood: sessionDraft.mood,
        source: 'voice',
        insights: sessionDraft.insights,
      })
      saved.push('reflection')
    }

    if (saveMood) {
      addMood(sessionDraft.mood)
      saved.push('mood entry')
    }

    memoryIds.forEach((id) => {
      const candidate = sessionDraft.memoryCandidates.find((item) => item.id === id)
      if (candidate) addMemory(candidate.text, candidate.category)
    })
    if (memoryIds.length > 0) saved.push(`${memoryIds.length} memory item${memoryIds.length > 1 ? 's' : ''}`)

    setReviewOpen(false)
    setSessionDraft(null)
    toast(`Saved ${saved.join(', ')}`, { description: 'Everything else was discarded.' })
    if (saveJournal) navigate('/app/user/journal')
  }

  function handleDiscard() {
    setReviewOpen(false)
    setSessionDraft(null)
    toast('Nothing was saved', { tone: 'info', description: 'The conversation was not kept anywhere.' })
  }

  const activeMode: ConversationMode = safetyModeActive ? 'safety' : mode

  return (
    <>
      <PageHeader
        title="Talk to Soba"
        description="Speak naturally. You can stop at any time, and nothing is saved unless you choose to keep it."
        action={
          <Badge
            tone={activeMode === 'safety' ? 'terracotta' : activeMode === 'support' ? 'amber' : 'sage'}
            size="md"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
          >
            {modeCopy[activeMode].label}
          </Badge>
        }
      />

      {/* Mode strip — makes the three conversation modes legible at a glance */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/70 p-2">
        {(['normal', 'support', 'safety'] as ConversationMode[]).map((item) => {
          const isActive = activeMode === item
          return (
            <span
              key={item}
              className={cn(
                'flex-1 rounded-xl px-3.5 py-2.5 text-center text-xs font-medium transition-colors sm:text-left',
                isActive
                  ? item === 'safety'
                    ? 'bg-terracotta-soft text-terracotta-dark'
                    : item === 'support'
                      ? 'bg-amber-soft text-[#7E6220]'
                      : 'bg-cream text-brown-dark'
                  : 'text-ink-muted',
              )}
            >
              <span className="block font-semibold">{modeCopy[item].label}</span>
              <span className="mt-0.5 hidden text-[11px] leading-snug opacity-80 sm:block">
                {modeCopy[item].detail}
              </span>
            </span>
          )
        })}
      </div>

      {activeMode === 'safety' ? (
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

      {activeMode === 'support' ? (
        <div className="mb-6 rounded-3xl border border-amber/30 bg-amber-soft/70 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Wind className="mt-0.5 h-5 w-5 shrink-0 text-[#7E6220]" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-[#7E6220]">Would slowing down help?</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#7E6220]/85">
                  Soba can guide two minutes of slow breathing. The conversation stays exactly where
                  you left it.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:shrink-0">
              <Button onClick={() => setGroundingOpen(true)}>
                <Wind className="h-4 w-4" aria-hidden="true" />
                Start breathing
              </Button>
              <Button variant="ghost" onClick={() => setMode('normal')}>
                Keep talking
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
            activeMode === 'safety'
              ? 'border-terracotta/25 bg-terracotta-soft/40'
              : activeMode === 'support'
                ? 'border-amber/25 bg-amber-soft/30'
                : 'bg-cream/60',
          )}
        >
          <VoiceOrb state={voiceState} safetyMode={activeMode === 'safety'} size={250} />

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
              ? 'You can review a summary of this conversation and choose what to keep.'
              : `Start wherever you want, ${user?.preferredName ?? 'there'}. There is no right way to begin.`}
          </p>

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
              {micOn ? (
                <Mic className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MicOff className="h-4 w-4" aria-hidden="true" />
              )}
              {micOn ? 'Mic on' : 'Mic off'}
            </Button>
            <Button variant="outline" size="lg" onClick={handleEndSession} disabled={ended}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              End session
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => setGroundingOpen(true)}>
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
            This session is private.{' '}
            {privacy.storeRawAudio
              ? 'Raw audio storage is currently enabled in your privacy settings.'
              : 'Raw audio is not stored,'}{' '}
            and nothing is saved unless you choose to keep it at the end.
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

          {!ended ? (
            <div className="border-t border-line px-5 py-4">
              <p className="text-xs font-medium text-ink-muted">Not sure where to start?</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {suggestedPrompts.slice(0, 2).map((prompt) => (
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
                  onClick={() => send(supportTriggerPhrase)}
                  className="rounded-full border border-amber/40 bg-amber-soft px-3 py-1.5 text-xs font-medium text-[#7E6220] transition hover:bg-amber-soft/80"
                  title="Demonstrates Support Mode"
                >
                  Demo: support mode
                </button>
                <button
                  type="button"
                  onClick={() => send(safetyTriggerPhrase)}
                  className="rounded-full border border-terracotta/30 bg-terracotta-soft px-3 py-1.5 text-xs font-medium text-terracotta-dark transition hover:bg-terracotta-soft/80"
                  title="Demonstrates how Soba escalates a serious wellbeing signal"
                >
                  Demo: safety mode
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
              <Button fullWidth onClick={() => setReviewOpen(true)} disabled={!sessionDraft}>
                {sessionDraft ? 'Review this conversation' : 'Nothing left to review'}
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

      <SessionReview
        open={reviewOpen}
        draft={sessionDraft}
        onClose={() => setReviewOpen(false)}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      <GroundingPlayer
        open={groundingOpen}
        activity={groundingActivity}
        onClose={() => {
          setGroundingOpen(false)
          if (mode === 'support') setMode('normal')
        }}
      />
    </>
  )
}
