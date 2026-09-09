import { useState } from 'react'
import { Accessibility, LogOut, Type, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/Feedback'
import { SectionCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Tabs, Toggle } from '../../components/ui/Controls'
import { useAuth } from '../../context/AuthContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useToast } from '../../context/ToastContext'
import type { InteractionPreference } from '../../types'

const interactionOptions = [
  { value: 'listen-first', label: 'Listen first' },
  { value: 'suggestions', label: 'Offer suggestions' },
  { value: 'balanced', label: 'Balanced' },
]

export default function Settings() {
  const { user, updateUser, signOut } = useAuth()
  const preferences = usePreferences()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [preferredName, setPreferredName] = useState(user?.preferredName ?? '')
  const [interaction, setInteraction] = useState<InteractionPreference>(
    user?.interactionPreference ?? 'listen-first',
  )

  return (
    <>
      <PageHeader title="Settings" description="Your account, how Soba responds, and accessibility." />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Profile"
          description="How Soba addresses you."
          icon={<UserRound className="h-[18px] w-[18px]" />}
        >
          <div className="space-y-4">
            <Input
              label="Preferred name"
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
            />
            <Input label="Email" value={user?.email ?? ''} disabled hint="Contact support to change your email." />
            <Select
              label="How should Soba respond?"
              options={interactionOptions}
              value={interaction}
              onChange={(event) => setInteraction(event.target.value as InteractionPreference)}
              hint="Changes tone and pacing only. It never changes Soba's safety boundaries."
            />
            <Button
              onClick={() => {
                updateUser({ preferredName, interactionPreference: interaction })
                toast('Settings saved')
              }}
            >
              Save changes
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Accessibility"
          description="These apply across the whole app and are saved on this device."
          icon={<Accessibility className="h-[18px] w-[18px]" />}
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-medium text-brown-dark">
                <Type className="h-4 w-4" aria-hidden="true" />
                Text size
              </p>
              <Tabs
                tabs={[
                  { value: 'default', label: 'Default' },
                  { value: 'large', label: 'Large' },
                ]}
                value={preferences.textSize}
                onChange={preferences.setTextSize}
              />
            </div>

            <Toggle
              checked={preferences.highContrast}
              onChange={preferences.setHighContrast}
              label="Higher contrast"
              description="Strengthens text and border contrast throughout the interface."
            />

            <Toggle
              checked={preferences.reducedMotion}
              onChange={preferences.setReducedMotion}
              label="Reduce motion"
              description="Removes transitions and animation. Your system preference is respected automatically."
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Session" description="Sign out of Soba on this device." className="mt-5">
        <Button
          variant="outline"
          onClick={() => {
            signOut()
            navigate('/login', { replace: true })
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </SectionCard>

      <p className="mt-6 text-xs leading-relaxed text-ink-muted">
        Soba is an emotional support companion and is not a substitute for professional mental health
        care.
      </p>
    </>
  )
}
