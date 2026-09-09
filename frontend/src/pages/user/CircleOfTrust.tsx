import { useState } from 'react'
import {
  Check,
  Copy,
  MessageCircle,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { EmptyState, PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { ContactRequestModal } from '../../components/dashboard/ContactRequestModal'
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

const INVITE_CODE = 'SOBA-8V3K-2QNP'

export default function CircleOfTrust() {
  const { contacts, addContact, updateContact, removeContact, supportRequests } = useAppData()
  const { toast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<TrustedContact | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestFor, setRequestFor] = useState<string | undefined>(undefined)

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [priority, setPriority] = useState<TrustedContact['priority']>('secondary')
  const [alerts, setAlerts] = useState(false)

  const recentRequests = supportRequests.slice(0, 4)

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

  function openRequest(contactId?: string) {
    setRequestFor(contactId)
    setRequestOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Circle of Trust"
        description="The people Soba can help you reach. You decide who belongs here and what each person can do."
        action={
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={() => openRequest()}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Ask someone to reach out
            </Button>
            <Button size="lg" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Add trusted person
            </Button>
          </div>
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
                  <dd className="truncate font-medium text-brown-dark">
                    {contact.phone || 'Not provided'}
                  </dd>
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

              {contact.status === 'active' ? (
                <div className="mt-5">
                  <Button size="sm" fullWidth onClick={() => openRequest(contact.id)}>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Ask {contact.name} to reach out
                  </Button>
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-secondary">
                  Soba can only send a request once {contact.name} accepts the invitation. You can
                  still call or message directly.
                </p>
              )}

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!contact.phone}
                  onClick={() =>
                    toast(`Opening your phone to call ${contact.name}`, {
                      tone: 'info',
                      description: 'Soba does not place the call itself.',
                    })
                  }
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!contact.phone}
                  onClick={() =>
                    toast(`Opening a message to ${contact.name}`, {
                      tone: 'info',
                      description: 'The text stays editable in your own app.',
                    })
                  }
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

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {/* Guardian invitation (F1 step 7) */}
        <SectionCard
          title="Invite a parent or guardian"
          description="Share this code so someone can request a connection. You approve it before anything is shared."
          icon={<UserPlus className="h-[18px] w-[18px]" />}
        >
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-line bg-cream/50 px-5 py-4">
            <code className="flex-1 font-mono text-lg tracking-wider text-brown-dark">{INVITE_CODE}</code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(INVITE_CODE)
                toast('Invite code copied')
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </Button>
          </div>
          <ol className="mt-4 space-y-2 text-sm leading-relaxed text-ink-secondary">
            {[
              'They create a guardian account and enter this code.',
              'You review who accepted before the link becomes active.',
              'Sharing scopes start empty and are configured by you afterwards.',
            ].map((item, index) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cream text-[10px] font-semibold text-brown">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="Recent requests"
          description="Requests you have sent through Soba, and what happened to them."
        >
          {recentRequests.length === 0 ? (
            <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm leading-relaxed text-ink-secondary">
              You have not asked anyone to reach out yet. When you do, the status appears here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {recentRequests.map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brown-dark">
                      {request.contactName}
                    </p>
                    <p className="text-xs text-ink-muted">Sent at {request.createdAt}</p>
                  </div>
                  <Badge
                    tone={
                      request.status === 'acknowledged'
                        ? 'sage'
                        : request.status === 'cancelled' || request.status === 'expired'
                          ? 'neutral'
                          : 'amber'
                    }
                  >
                    {request.status === 'acknowledged'
                      ? 'Acknowledged'
                      : request.status === 'accepted'
                        ? 'Accepted by service'
                        : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

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
            hint="Optional and user-entered. Used only for calls and messages you start yourself."
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
            <Input
              label="Phone"
              type="tel"
              value={editing.phone}
              onChange={(event) => {
                updateContact(editing.id, { phone: event.target.value })
                setEditing({ ...editing, phone: event.target.value })
              }}
              hint="User-entered and unverified. Automatic alerts go to their linked Soba account, not this number."
            />
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
            {editing.status === 'invited' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-soft/60 px-4 py-3">
                <p className="text-xs leading-relaxed text-[#7E6220]">
                  Invitation is still pending acceptance.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    updateContact(editing.id, { status: 'active' })
                    setEditing({ ...editing, status: 'active' })
                    toast(`${editing.name} accepted the invitation`, {
                      description: 'Demo shortcut: simulates their acceptance.',
                    })
                  }}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Simulate acceptance
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ContactRequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        contacts={contacts}
        preselectedId={requestFor}
      />
    </>
  )
}
