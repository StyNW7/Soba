import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, AtSign, HeartHandshake, KeyRound, User, UserRound } from 'lucide-react'
import { AuthLayout } from '../../layouts/AuthLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
import { writeStorage } from '../../lib/storage'
import type { Role } from '../../types'
import { StepIndicator } from './StepIndicator'

export interface SignupDraft {
  name: string
  email: string
  password: string
  role: Role
}

export const SIGNUP_DRAFT_KEY = 'soba.signup.draft'

const roleOptions: { value: Role; title: string; subtitle: string; detail: string; icon: typeof UserRound }[] = [
  {
    value: 'user',
    title: 'I am using Soba for myself',
    subtitle: 'User',
    detail: 'Talk to Soba, track how you have been, and stay in control of what is shared.',
    icon: UserRound,
  },
  {
    value: 'guardian',
    title: 'I am supporting someone',
    subtitle: 'Parent / Guardian',
    detail: 'See wellbeing patterns and safety signals, without reading private conversations.',
    icon: HeartHandshake,
  },
]

export default function SignUp() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validateAccount() {
    const next: Record<string, string> = {}
    if (name.trim().length < 2) next.name = 'Please enter your name.'
    if (!email.includes('@') || email.trim().length < 5) next.email = 'Please enter a valid email address.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleAccountSubmit(event: FormEvent) {
    event.preventDefault()
    if (validateAccount()) setStep(2)
  }

  function handleRoleContinue() {
    if (!role) {
      setErrors({ role: 'Choose how you will be using Soba.' })
      return
    }
    const draft: SignupDraft = { name: name.trim(), email: email.trim(), password, role }
    writeStorage(SIGNUP_DRAFT_KEY, draft)
    navigate('/onboarding')
  }

  return (
    <AuthLayout
      quote="You do not have to know exactly what to say."
      attribution="Starting with Soba"
    >
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <StepIndicator current={step} total={4} />

        {step === 1 ? (
          <>
            <h1 className="mt-6 heading-serif text-[32px] leading-tight">Create your account</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              This takes about a minute. You can change everything later.
            </p>

            <form onSubmit={handleAccountSubmit} className="mt-7 space-y-4" noValidate>
              <Input
                label="Full name"
                autoComplete="name"
                placeholder="Nara Amelia"
                icon={<User className="h-4 w-4" />}
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={errors.name}
                required
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                icon={<AtSign className="h-4 w-4" />}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={errors.email}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                icon={<KeyRound className="h-4 w-4" />}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                hint="Use something you do not use elsewhere."
                required
              />
              <Button type="submit" size="lg" fullWidth className="mt-2">
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-ink-secondary">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-brown hover:text-apricot">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 heading-serif text-[32px] leading-tight">How will you use Soba?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              This sets up the right experience. The two are deliberately different.
            </p>

            <div className="mt-7 space-y-3.5">
              {roleOptions.map((option) => {
                const selected = role === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setRole(option.value)
                      setErrors({})
                    }}
                    aria-pressed={selected}
                    className={cn(
                      'w-full rounded-3xl border p-5 text-left transition-all duration-200',
                      selected
                        ? 'border-apricot bg-apricot-soft/50 shadow-soft'
                        : 'border-line bg-surface hover:border-apricot/40 hover:bg-cream/40',
                    )}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
                          selected ? 'bg-apricot text-white' : 'bg-cream text-brown',
                        )}
                      >
                        <option.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
                          {option.subtitle}
                        </p>
                        <p className="mt-1 text-base font-semibold text-brown-dark">{option.title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{option.detail}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {errors.role ? (
              <p role="alert" className="mt-3 text-sm font-medium text-terracotta-dark">
                {errors.role}
              </p>
            ) : null}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="ghost" size="lg" onClick={() => setStep(1)} className="sm:w-auto">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              <Button size="lg" fullWidth onClick={handleRoleContinue}>
                Continue
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
