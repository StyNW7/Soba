import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthLayout } from '../../layouts/AuthLayout'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const {
    startLogin,
    isAuthenticated,
    isReady,
    error: connectionError,
    refresh,
  } = useAuth()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const location = useLocation()
  const failed = new URLSearchParams(location.search).get('status')
  if (isReady && isAuthenticated) return <Navigate to="/app" replace />
  async function login() {
    setBusy(true)
    setError('')
    try {
      await startLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in could not start.')
      setBusy(false)
    }
  }
  return (
    <AuthLayout>
      <div className="rounded-3xl border border-line bg-surface p-8 shadow-soft">
        <h1 className="heading-serif text-3xl">Your space starts here</h1>
        <p className="my-5 text-ink-secondary">
          Sign in or create an account through SOBA’s secure sign-in provider.
          Choose Google on the provider page.
        </p>
        {(error || connectionError || failed) && (
          <p role="alert" className="my-4 text-terracotta-dark">
            {error ||
              connectionError ||
              'Sign-in was cancelled or could not finish. Please try again.'}
          </p>
        )}
        <Button type="button" onClick={login} loading={busy} fullWidth>
          Continue to secure sign-in
        </Button>
        {connectionError && (
          <Button type="button" variant="ghost" onClick={() => void refresh()}>
            Retry connection
          </Button>
        )}
        <p className="mt-5 text-sm text-ink-secondary">
          You choose what to save and who can support you.
        </p>
        <Link className="mt-5 inline-block underline" to="/">
          Back to SOBA
        </Link>
      </div>
    </AuthLayout>
  )
}
