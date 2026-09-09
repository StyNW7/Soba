import { useState } from 'react'
import { MessageCircle, Phone, Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { EmptyState, PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import type { TrustedContact } from '../../types'

const statusTone: Record<TrustedContact['status'], 'sage' | 'amber' | 'neutral'> = {
  active: 'sage',
  invited: 'amber',
  unlinked: 'neutral',
  revoked: 'neutral',
}

const statusLabel: Record<TrustedContact['status'], string> = {
  active: 'Connected',
  invited: 'Invitation sent',
  unlinked: 'Not linked',
  revoked: 'Access revoked',
}

const priorityOptions = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'backup', label: 'Backup' },
]

export default function CircleOfTrust() {
  const { contacts, addContact, updateContact, removeContact } = useAppData()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<TrustedContact | null>(null)

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [priority, setPriority] = useState<TrustedContact['priority']>('secondary')
  const [alerts, setAlerts] = useState(false)

  function resetForm() {
    setName('')
    setRelationship('')
    setPhone('')
    setPriority('secondary')
    setAlerts(false)
  }

  function handleAdd() {
    if (!name.trim() || !relationship.trim()) return
    addContact({
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      status: 'invited',
      priority,
      canReceiveAlerts: alerts,
    })
    resetForm()
    setAddOpen(false)
    toast('Invitation sent', { description: 'They join your circle once they accept.' })
  }

  return (
    <>
      <PageHeader
        title="Circle of Trust"
        description="The people Soba can help you reach. You decide who belongs here and what each person can do."
        action={
          <Button size="lg" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add trusted person
          </Button>
        }
      />

      <Card tone="cream" padding="lg" className="mb-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-brown-dark">
              You are always in control of who belongs in your Circle of Trust.
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
              Adding someone does not give them access to your conversations. Alerts are a separate
              permission you grant person by person, and you can remove anyone at any time.
            </p>
          </div>
        </div>
      </Card>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No trusted contacts yet"
          description="Add someone you trust so Soba can help you reach them when needed."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add trusted person
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {contacts.map((contact) => (
            <Card key={contact.id} padding="lg" className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3.5">
                  <Avatar initials={contact.avatarInitials} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-brown-dark">{contact.name}</h2>
                    <p className="text-sm text-ink-secondary">{contact.relationship}</p>
                  </div>
                </div>
                <Badge tone={statusTone[contact.status]}>{statusLabel[contact.status]}</Badge>
              </div>

              <dl className="mt-5 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Phone</dt>
                  <dd className="truncate font-medium text-brown-dark">{contact.phone || 'Not provided'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Priority</dt>
                  <dd className="font-medium capitalize text-brown-dark">{contact.priority}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-muted">Safety alerts</dt>
                  <dd className="font-medium text-brown-dark">
                    {contact.canReceiveAlerts ? 'Allowed' : 'Not allowed'}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toast(`Opening your phone to call ${contact.name}`, { tone: 'info' })}
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toast(`Opening a message to ${contact.name}`, { tone: 'info' })}
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Message
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(contact)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PrivacyNote className="mt-6">
        Contacts can be reached through Soba. They cannot read your conversations, journal, or
        memories.
      </PrivacyNote>

      {/* Add */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add someone you trust"
        description="They receive an invitation and join once they accept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim() || !relationship.trim()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Maria"
            data-autofocus
            required
          />
          <Input
            label="Relationship"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            placeholder="Mother"
            required
          />
          <Input
            label="Phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+62 812 0000 0000"
            hint="Optional. Used only for calls and messages you start yourself."
          />
          <Select
            label="Priority"
            options={priorityOptions}
            value={priority}
            onChange={(event) => setPriority(event.target.value as TrustedContact['priority'])}
          />
          <div className="rounded-2xl border border-line bg-muted/60 p-4">
            <Toggle
              checked={alerts}
              onChange={setAlerts}
              label="Allow safety alerts"
              description="If Soba detects a serious wellbeing signal, this person can be notified that a check-in is recommended. Your conversation is never shared."
            />
          </div>
        </div>
      </Modal>

      {/* Edit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : ''}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                if (!editing) return
                removeContact(editing.id)
                setEditing(null)
                toast('Removed from your circle', { tone: 'info' })
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
            <Button onClick={() => setEditing(null)} data-autofocus>
              Done
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-5">
            <Select
              label="Priority"
              options={priorityOptions}
              value={editing.priority}
              onChange={(event) => {
                const next = event.target.value as TrustedContact['priority']
                updateContact(editing.id, { priority: next })
                setEditing({ ...editing, priority: next })
              }}
            />
            <div className="rounded-2xl border border-line bg-muted/60 p-4">
              <Toggle
                checked={editing.canReceiveAlerts}
                onChange={(value) => {
                  updateContact(editing.id, { canReceiveAlerts: value })
                  setEditing({ ...editing, canReceiveAlerts: value })
                }}
                label="Allow safety alerts"
                description="Only a recommendation to check in is sent. Never the conversation itself."
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
