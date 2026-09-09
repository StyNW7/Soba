import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AtSign, KeyRound, TriangleAlert } from 'lucide-react'
import { AuthLayout } from '../../layouts/AuthLayout'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { homeRouteFor, useAuth } from '../../context/AuthContext'
import type { Role } from '../../types'

export default function Login() {
  const { signIn, signInAs } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<'form' | Role | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading('form')
    try {
      const user = await signIn(email, password)
      navigate(homeRouteFor(user.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function handleDemo(role: Role) {
    setError('')
    setLoading(role)
    try {
      const user = await signInAs(role)
      navigate(homeRouteFor(user.role), { replace: true })
    } finally {
      setLoading(null)
    }
  }

  return (
    <AuthLayout>
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <h1 className="heading-serif text-[32px] leading-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          Sign in to continue where you left off.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl border border-terracotta/30 bg-terracotta-soft px-4 py-3 text-sm text-terracotta-dark"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            icon={<AtSign className="h-4 w-4" />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            icon={<KeyRound className="h-4 w-4" />}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <div className="flex items-center justify-between pt-1">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-line text-apricot accent-[#D4954D]"
              />
              Remember me
            </label>
            <Link to="/support" className="text-sm font-medium text-brown hover:text-apricot">
              Need help?
            </Link>
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading === 'form'} className="mt-2">
            Sign In
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-secondary">
          New to Soba?{' '}
          <Link to="/signup" className="font-semibold text-brown hover:text-apricot">
            Create an account
          </Link>
        </p>

        <div className="mt-7 border-t border-line pt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Demo access
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            Explore either experience with prefilled sample data.
          </p>
          <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => handleDemo('user')}
              loading={loading === 'user'}
            >
              Demo User
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDemo('guardian')}
              loading={loading === 'guardian'}
            >
              Demo Guardian
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-muted">
        Soba is an emotional support companion and is not a substitute for professional mental
        health care.
      </p>
    </AuthLayout>
  )
}
