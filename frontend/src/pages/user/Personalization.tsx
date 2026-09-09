import { AudioLines, Brain, Check, Ear, Sparkles, Volume2 } from 'lucide-react'
import { PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Toggle } from '../../components/ui/Controls'
import { Waveform } from '../../components/voice/VoiceOrb'
import { cn } from '../../lib/cn'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import type { Personalization as PersonalizationPrefs, VoiceId } from '../../types'

const personalities: {
  value: PersonalizationPrefs['personality']
  title: string
  detail: string
  sample: string
}[] = [
  {
    value: 'calm',
    title: 'Calm',
    detail: 'Slower, quieter, and unhurried. Leaves more space between sentences.',
    sample: 'There is no rush here. Say as much or as little as you want.',
  },
  {
    value: 'friendly',
    title: 'Friendly',
    detail: 'Warmer and more conversational, closer to how a friend would speak.',
    sample: 'Hey, that sounds like a lot. Tell me what happened.',
  },
  {
    value: 'encouraging',
    title: 'Encouraging',
    detail: 'Gently affirming, more likely to name what you are already doing well.',
    sample: 'You brought this up, which is not a small thing. Let us take it from there.',
  },
]

const voices: { value: VoiceId; title: string; detail: string }[] = [
  { value: 'marin', title: 'Marin', detail: 'Mid-range and even. The default reference voice.' },
  { value: 'cedar', title: 'Cedar', detail: 'Lower and slightly warmer, with a slower cadence.' },
]

export default function Personalization() {
  const { personalization, updatePersonalization, device } = useAppData()
  const { toast } = useToast()

  return (
    <>
      <PageHeader
        title="Soba Personalization"
        description="How Soba sounds and how it responds. These change tone and pacing only — never what Soba will or will not do."
        action={
          <Badge tone="cream" size="md">
            {device ? `Applies to ${device.name} and the app` : 'Applies to the app'}
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <SectionCard
            title="Personality"
            description="The register Soba speaks in."
            icon={<Sparkles className="h-[18px] w-[18px]" />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {personalities.map((option) => {
                const selected = personalization.personality === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      updatePersonalization({ personality: option.value })
                      toast(`Personality set to ${option.title}`)
                    }}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-full flex-col rounded-2xl border p-4 text-left transition-all duration-200',
                      selected
                        ? 'border-apricot bg-apricot-soft/50 shadow-soft'
                        : 'border-line hover:border-apricot/40 hover:bg-cream/50',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-brown-dark">{option.title}</span>
                      {selected ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-apricot text-white">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-ink-secondary">
                      {option.detail}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-5 rounded-2xl bg-cream px-5 py-4">
              <p className="text-xs font-medium text-ink-muted">How that sounds</p>
              <p className="mt-1.5 font-serif text-lg leading-snug text-brown-dark">
                &ldquo;
                {personalities.find((option) => option.value === personalization.personality)?.sample}
                &rdquo;
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Voice"
            description="The reference voice used by the companion and the app."
            icon={<Volume2 className="h-[18px] w-[18px]" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {voices.map((option) => {
                const selected = personalization.voiceId === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      updatePersonalization({ voiceId: option.value })
                      toast(`Voice set to ${option.title}`)
                    }}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200',
                      selected
                        ? 'border-apricot bg-apricot-soft/50 shadow-soft'
                        : 'border-line hover:border-apricot/40 hover:bg-cream/50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                        selected ? 'bg-apricot' : 'bg-cream',
                      )}
                    >
                      <span className="h-5 w-8">
                        <Waveform
                          state={selected ? 'speaking' : 'idle'}
                          bars={5}
                          tone={selected ? 'light' : 'dark'}
                        />
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-brown-dark">{option.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-secondary">
                        {option.detail}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-muted">
              Voice selection changes delivery only. It does not change Soba&rsquo;s boundaries, its
              safety behaviour, or what it is willing to discuss.
            </p>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Interaction preference"
            description="What Soba does first when you bring something up."
            icon={<Ear className="h-[18px] w-[18px]" />}
          >
            <div className="space-y-5">
              <Toggle
                checked={personalization.listenFirst}
                onChange={(value) => {
                  updatePersonalization({ listenFirst: value })
                  toast(value ? 'Soba will listen first' : 'Soba will offer suggestions sooner')
                }}
                label="Listen before offering suggestions"
                description="When on, Soba stays with what you are saying and waits to be asked before proposing anything."
              />
              <Toggle
                checked={personalization.adaptiveTone}
                onChange={(value) => updatePersonalization({ adaptiveTone: value })}
                label="Adapt tone to how I sound"
                description="Softer and slower when things feel heavy, a little brighter when they do not."
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Memory use"
            description="Whether approved memories are used in conversation."
            icon={<Brain className="h-[18px] w-[18px]" />}
          >
            <Toggle
              checked={personalization.useMemory}
              onChange={(value) => {
                updatePersonalization({ useMemory: value })
                toast(value ? 'Soba may use saved memories' : 'Soba will not use saved memories')
              }}
              label="Use saved memories in conversation"
              description="Saving a memory and letting Soba use it are separate decisions. Turning this off keeps your saved memories but stops Soba referring to them."
            />
            <PrivacyNote className="mt-5">
              Manage the individual memories themselves in Memory &amp; Privacy. Nothing here is
              visible to a guardian.
            </PrivacyNote>
          </SectionCard>

          <Card tone="cream" padding="lg">
            <h2 className="flex items-center gap-2 text-base font-semibold text-brown-dark">
              <AudioLines className="h-4 w-4 text-apricot" aria-hidden="true" />
              Current setup
            </h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              {[
                ['Personality', personalization.personality],
                ['Voice', personalization.voiceId],
                ['Opens by', personalization.listenFirst ? 'listening' : 'suggesting'],
                ['Adaptive tone', personalization.adaptiveTone ? 'On' : 'Off'],
                ['Uses memory', personalization.useMemory ? 'Yes' : 'No'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-ink-secondary">{label}</dt>
                  <dd className="font-medium capitalize text-brown-dark">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  )
}
