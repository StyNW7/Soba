import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '../../layouts/AuthLayout'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Controls'
import { cn } from '../../lib/cn'
import { clearStorage, readStorage } from '../../lib/storage'
import { homeRouteFor, useAuth } from '../../context/AuthContext'
import type { InteractionPreference } from '../../types'
import { SIGNUP_DRAFT_KEY } from './SignUp'
import type { SignupDraft } from './SignUp'
import { StepIndicator } from './StepIndicator'

const interactionOptions: { value: InteractionPreference; title: string; detail: string }[] = [
  {
    value: 'listen-first',
    title: 'Listen first',
    detail: 'Soba stays with what you are saying before offering anything.',
  },
  {
    value: 'suggestions',
    title: 'Offer suggestions',
    detail: 'Soba offers grounding or next steps more readily.',
  },
  { value: 'balanced', title: 'Balanced', detail: 'A mix of both, adjusted to the moment.' },
]

const ageRanges = [
  { value: '18-24', label: '18 to 24' },
  { value: '25-34', label: '25 to 34' },
  { value: '35-44', label: '35 to 44' },
  { value: '45+', label: '45 and above' },
]

const relationships = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Other', label: 'Other' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { signUp, user } = useAuth()
  const [draft, setDraft] = useState<SignupDraft | null | undefined>(undefined)
  const [step, setStep] = useState(3)
  const [loading, setLoading] = useState(false)

  // Step 3 fields
  const [preferredName, setPreferredName] = useState('')
  const [ageRange, setAgeRange] = useState('18-24')
  const [interaction, setInteraction] = useState<InteractionPreference>('listen-first')
  const [relationship, setRelationship] = useState('Mother')
  const [inviteCode, setInviteCode] = useState('')

  // Step 4 consent
  const [consentProcessing, setConsentProcessing] = useState(false)
  const [consentPatterns, setConsentPatterns] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = readStorage<SignupDraft | null>(SIGNUP_DRAFT_KEY, null)
    setDraft(stored)
    if (stored) setPreferredName(stored.name.split(' ')[0])
  }, [])

  if (draft === undefined) return null
  if (!draft) return <Navigate to={user ? homeRouteFor(user.role) : '/signup'} replace />

  const isGuardian = draft.role === 'guardian'

  async function handleComplete() {
    if (!draft) return
    if (!consentProcessing) {
      setErrors({ consent: 'Please confirm you understand how Soba processes what you say.' })
      return
    }
    setLoading(true)
    try {
      const created = await signUp({
        name: draft.name,
        email: draft.email,
        password: draft.password,
        role: draft.role,
        preferredName,
        ageRange: isGuardian ? undefined : ageRange,
        interactionPreference: isGuardian ? undefined : interaction,
        relationship: isGuardian ? relationship : undefined,
      })
      clearStorage(SIGNUP_DRAFT_KEY)
      navigate(homeRouteFor(created.role), { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      quote={isGuardian ? 'Support without invading privacy.' : 'Your feelings. Your space. Your choice.'}
      attribution="Setting up Soba"
    >
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <StepIndicator current={step} total={4} />

        {step === 3 ? (
          <>
            <h1 className="mt-6 heading-serif text-[32px] leading-tight">
              {isGuardian ? 'Tell us about your connection' : 'A little personalization'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {isGuardian
                ? 'This helps Soba frame guidance for your relationship. You can change it later.'
                : 'This shapes how Soba responds. Nothing here is a clinical question.'}
            </p>

            <div className="mt-7 space-y-5">
              <Input
                label="What should Soba call you?"
                value={preferredName}
                onChange={(event) => setPreferredName(event.target.value)}
                placeholder="Nara"
              />

              {isGuardian ? (
                <>
                  <Select
                    label="Your relationship"
                    options={relationships}
                    value={relationship}
                    onChange={(event) => setRelationship(event.target.value)}
                  />
                  <Input
                    label="Invitation code"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="SOBA-XXXX-XXXX"
                    hint="The person you support shares this from their Circle of Trust. You can add it later."
                  />
                </>
              ) : (
                <>
                  <Select
                    label="Age range"
                    options={ageRanges}
                    value={ageRange}
                    onChange={(event) => setAgeRange(event.target.value)}
                    hint="Used to keep language and support pathways appropriate."
                  />

                  <fieldset>
                    <legend className="text-sm font-medium text-brown-dark">
                      How would you like Soba to respond?
                    </legend>
                    <div className="mt-3 space-y-2.5">
                      {interactionOptions.map((option) => {
                        const selected = interaction === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setInteraction(option.value)}
                            aria-pressed={selected}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                              selected
                                ? 'border-apricot bg-apricot-soft/50'
                                : 'border-line hover:border-apricot/40 hover:bg-cream/40',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                selected ? 'border-apricot bg-apricot text-white' : 'border-line',
                              )}
                            >
                              {selected ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-brown-dark">
                                {option.title}
                              </span>
                              <span className="mt-0.5 block text-sm leading-relaxed text-ink-secondary">
                                {option.detail}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                </>
              )}
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="ghost" size="lg" onClick={() => navigate('/signup')} className="sm:w-auto">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button size="lg" fullWidth onClick={() => setStep(4)}>
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-6 heading-serif text-[32px] leading-tight">Privacy &amp; consent</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              Read this properly. These defaults are the product, not fine print.
            </p>

            <div className="mt-6 rounded-3xl border border-sage/30 bg-sage-soft/70 p-5">
              <p className="flex items-start gap-2.5 text-sm font-semibold text-sage-deep">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Soba does not share private conversation transcripts with guardians by default.
              </p>
              <p className="mt-2 pl-[26px] text-sm leading-relaxed text-sage-deep">
                Guardians see wellbeing patterns and safety signals only. Journals, transcripts, and
                memories stay with the person they belong to.
              </p>
            </div>

            <ul className="mt-6 space-y-3 text-sm leading-relaxed text-ink-secondary">
              {[
                'Raw audio storage is off by default.',
                'You review every reflection before it is saved.',
                'You can export or delete everything at any time.',
                'Soba does not diagnose, prescribe, or replace professional care.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-brown-soft" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-7 space-y-5 border-t border-line pt-6">
              <Toggle
                checked={consentProcessing}
                onChange={(value) => {
                  setConsentProcessing(value)
                  setErrors({})
                }}
                label="I understand how Soba processes what I say"
                description="Required. Voice is processed to understand and respond, and nothing is saved without your review."
              />
              <Toggle
                checked={consentPatterns}
                onChange={setConsentPatterns}
                label="Show me patterns over time"
                description="Optional. Turns on mood trends built from your own check-ins. You can change this later."
              />
            </div>

            {errors.consent ? (
              <p role="alert" className="mt-4 text-sm font-medium text-terracotta-dark">
                {errors.consent}
              </p>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="ghost" size="lg" onClick={() => setStep(3)} className="sm:w-auto">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button size="lg" fullWidth onClick={handleComplete} loading={loading}>
                Complete setup
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
