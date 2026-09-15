import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { ProfileUpdate } from '../../api/schema'
import { useAuth, homeRouteFor } from '../../context/AuthContext'
import { AuthLayout } from '../../layouts/AuthLayout'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'

export default function Onboarding() {
  const { profile, isReady, saveProfile } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [role, setRole] = useState<'user' | 'guardian'>('user')
  const [age, setAge] = useState<ProfileUpdate['age_band']>('unknown')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!isReady) return <p role="status">Loading account…</p>
  if (!profile) return <Navigate to="/login" replace />
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!profile) return
    setBusy(true)
    setError('')
    try {
      await saveProfile({
        display_name: name.trim() || profile.display_name,
        roles: [role],
        age_band: age,
        locale: 'en-US',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        version: profile.version,
        shared_phone: profile.shared_phone,
      })
      navigate(homeRouteFor(role), { replace: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Setup failed. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout>
      <form
        onSubmit={submit}
        className="space-y-5 rounded-3xl border border-line bg-surface p-8"
      >
        <h1 className="heading-serif text-3xl">Set up your space</h1>
        <Input
          label="Display name"
          value={name}
          placeholder={profile.display_name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          label="I am here for"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          options={[
            { value: 'user', label: 'My own wellbeing' },
            { value: 'guardian', label: 'Supporting someone' },
          ]}
        />
        <Select
          label="Age"
          required
          value={age}
          onChange={(e) => setAge(e.target.value as typeof age)}
          options={[
            { value: 'unknown', label: 'Choose your age group' },
            { value: '18_plus', label: '18 or older' },
            { value: 'under_18', label: 'Under 18' },
          ]}
        />
        {age === 'under_18' && <p>This pilot is available to adults only.</p>}
        {error && (
          <p role="alert" className="text-terracotta-dark">
            {error}
          </p>
        )}
        <Button
          type="submit"
          loading={busy}
          disabled={age !== '18_plus'}
        >
          Complete setup
        </Button>
      </form>
    </AuthLayout>
  )
}
