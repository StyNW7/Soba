import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Accessibility, BellRing, LogOut, Type, UserRound } from 'lucide-react'
import { PageHeader } from '../../components/ui/Feedback'
import { SectionCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Tabs, Toggle } from '../../components/ui/Controls'
import { useAuth } from '../../context/AuthContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useToast } from '../../context/ToastContext'

const relationships = [
  { value: 'Mother', label: 'Mother' },
  { value: 'Father', label: 'Father' },
  { value: 'Guardian', label: 'Guardian' },
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Other', label: 'Other' },
]

export default function Settings() {
  const { user, updateUser, signOut } = useAuth()
  const preferences = usePreferences()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [preferredName, setPreferredName] = useState(user?.preferredName ?? '')
  const [relationship, setRelationship] = useState(user?.relationship ?? 'Mother')
  const [alertPush, setAlertPush] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(true)
  const [coachUpdates, setCoachUpdates] = useState(false)

  return (
    <>
      <PageHeader title="Settings" description="Your account, notifications, and accessibility." />

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Profile"
          description="How you appear inside Soba."
          icon={<UserRound className="h-[18px] w-[18px]" />}
        >
          <div className="space-y-4">
            <Input
              label="Preferred name"
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
            />
            <Input label="Email" value={user?.email ?? ''} disabled />
            <Select
              label="Relationship"
              options={relationships}
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
            />
            <Button
              onClick={() => {
                updateUser({ preferredName, relationship })
                toast('Settings saved')
              }}
            >
              Save changes
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Notifications"
          description="Alerts always stay generic. No private content appears on your lock screen."
          icon={<BellRing className="h-[18px] w-[18px]" />}
        >
          <div className="space-y-5">
            <Toggle
              checked={alertPush}
              onChange={setAlertPush}
              label="Safety alerts"
              description="Notify me when Soba recommends a check-in. Strongly recommended."
            />
            <Toggle
              checked={weeklySummary}
              onChange={setWeeklySummary}
              label="Weekly wellbeing summary"
              description="A short summary of direction over the week, sent on Sunday evenings."
            />
            <Toggle
              checked={coachUpdates}
              onChange={setCoachUpdates}
              label="Parent Coach updates"
              description="Occasional notifications when new guidance is published."
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Accessibility"
          description="Saved on this device."
          icon={<Accessibility className="h-[18px] w-[18px]" />}
          className="xl:col-span-2"
        >
          <div className="grid gap-6 sm:grid-cols-2">
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
            <div className="space-y-5">
              <Toggle
                checked={preferences.highContrast}
                onChange={preferences.setHighContrast}
                label="Higher contrast"
                description="Strengthens text and border contrast."
              />
              <Toggle
                checked={preferences.reducedMotion}
                onChange={preferences.setReducedMotion}
                label="Reduce motion"
                description="Removes transitions and animation."
              />
            </div>
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
        Soba shares wellbeing patterns and safety signals with you. It never shares private
        conversations, journals, or memories.
      </p>
    </>
  )
}
