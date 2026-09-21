import { useState } from 'react'
import { api } from '../../api/client'
import type {
  Contact,
  Link,
  Grant,
  Invite,
  Policy,
  SupportRequest,
  SupportResource,
  Referral,
  Alert,
  ReachOut,
} from '../../api/schema'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Screen, Panel, Field, Feedback, RemoteState } from './shared'
import { inputClass, useRemote, useAction, date, words } from './state'
import { isValidPhone, normalizePhone, PHONE_HINT } from '../../lib/format'

export function CirclePage() {
  const contacts = useRemote<Contact[]>('/v1/trusted-contacts', true)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relationship, setRelationship] =
    useState<Contact['relationship']>('friend')
  const action = useAction()
  return (
    <Screen
      title="Circle of trust"
      description="Adding a contact does not grant access or send an alert."
    >
      <Panel>
        <h2 className="text-xl font-semibold">Add a contact</h2>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void action.run(async () => {
              const normalized = normalizePhone(phone)
              setPhone(normalized)
              if (normalized && !isValidPhone(normalized))
                throw new Error(PHONE_HINT)
              await api('/v1/trusted-contacts', {
                method: 'POST',
                body: {
                  display_name: name,
                  phone: normalized || null,
                  relationship,
                },
              })
              setName('')
              setPhone('')
              contacts.reload()
            })
          }}
        >
          <Field label="Name">
            <input
              className={inputClass}
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Phone (optional, with country code)">
            <input
              className={inputClass}
              type="tel"
              placeholder="+6281297894752"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={(e) => setPhone(normalizePhone(e.target.value))}
            />
          </Field>
          <Field label="Relationship">
            <select
              className={inputClass}
              value={relationship}
              onChange={(e) =>
                setRelationship(e.target.value as typeof relationship)
              }
            >
              {['friend', 'family', 'guardian', 'other'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" loading={action.busy}>
            Add contact
          </Button>
          <Feedback {...action} />
        </form>
      </Panel>
      <RemoteState remote={contacts} empty={!contacts.value?.length} />
      {contacts.value?.map((c) => (
        <ContactCard
          key={`${c.id}:${c.version}`}
          contact={c}
          reload={contacts.reload}
        />
      ))}
      <LinksPanel />
      <SupportRequestsPanel />
    </Screen>
  )
}
function ContactCard({
  contact,
  reload,
}: {
  contact: Contact
  reload: () => void
}) {
  const action = useAction()
  const [name, setName] = useState(contact.display_name)
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [invite, setInvite] = useState<Invite | null>(null)
  const [kind, setKind] = useState<'trusted' | 'guardian'>('trusted')
  return (
    <Panel>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(async () => {
            const normalized = normalizePhone(phone)
            setPhone(normalized)
            if (normalized && !isValidPhone(normalized))
              throw new Error(PHONE_HINT)
            await api(`/v1/trusted-contacts/${contact.id}`, {
              method: 'PATCH',
              body: {
                display_name: name,
                phone: normalized || null,
                version: contact.version,
              },
            })
            reload()
          })
        }}
      >
        <Field label="Contact name">
          <input
            className={inputClass}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            type="tel"
            placeholder="+6281297894752"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={(e) => setPhone(normalizePhone(e.target.value))}
          />
        </Field>
        <p>
          {words(contact.relationship)} · {words(contact.status)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={action.busy}>
            Save contact
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={action.busy}
            onClick={() => {
              if (window.confirm('Delete this contact and revoke its links?'))
                void action.run(async () => {
                  await api(`/v1/trusted-contacts/${contact.id}`, {
                    method: 'DELETE',
                  })
                  reload()
                }, 'Deleted.')
            }}
          >
            Delete
          </Button>
        </div>
      </form>
      <Field label="Invite as">
        <select
          className={inputClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="trusted">Trusted contact</option>
          <option value="guardian">Guardian</option>
        </select>
      </Field>
      <Button
        type="button"
        variant="secondary"
        disabled={action.busy}
        onClick={() =>
          void action.run(async () => {
            setInvite(
              await api<Invite>('/v1/invites', {
                method: 'POST',
                body: { contact_id: contact.id, kind },
              }),
            )
          }, 'Invitation created. Share the code privately.')
        }
      >
        Create invitation
      </Button>
      {invite && (
        <div>
          <p>Invitation code · expires {date(invite.expires_at)}</p>
          <code className="block break-all rounded-xl bg-background p-3">
            {invite.code}
          </code>
        </div>
      )}
      {contact.status === 'active' && (
        <Button
          type="button"
          variant="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api('/v1/support-requests', {
                method: 'POST',
                body: { contact_id: contact.id, reason: 'user_request' },
              })
            }, 'Request created. Review and confirm it in Support requests below.')
          }
        >
          Prepare support request
        </Button>
      )}
      <Feedback {...action} />
    </Panel>
  )
}
export function LinksPanel() {
  const { profile } = useAuth()
  const links = useRemote<Link[]>('/v1/links', true)
  const grants = useRemote<Grant[]>('/v1/grants', true)
  const action = useAction()
  const [code, setCode] = useState('')
  const [scope, setScope] = useState<Grant['scope']>('wellbeing_pulse')
  return (
    <Panel>
      <h2 className="text-xl font-semibold">Connections and sharing</h2>
      <p>
        Accept an invitation, then wait for the owner to approve the link. The
        owner selects each sharing permission.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(async () => {
            await api('/v1/invites/accept', { method: 'POST', body: { code } })
            setCode('')
            links.reload()
          })
        }}
      >
        <Field label="Invitation code">
          <input
            className={inputClass}
            required
            minLength={32}
            maxLength={512}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={action.busy}>
          Accept invitation
        </Button>
      </form>
      <Feedback {...action} />
      <RemoteState remote={links} empty={!links.value?.length} />
      <RemoteState remote={grants} />
      {links.value?.map((link) => (
        <div key={link.id} className="space-y-3 border-t border-line pt-4">
          <h3 className="font-semibold">
            {link.subject_display_name} → {link.recipient_display_name}
          </h3>
          <p>
            {link.kind} · {link.status}
          </p>
          {link.subject_id === profile?.id && link.status === 'accepted' && (
            <Button
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(`/v1/links/${link.id}/approve`, {
                    method: 'POST',
                    body: { version: link.version },
                  })
                  links.reload()
                })
              }
            >
              Approve connection
            </Button>
          )}
          {link.subject_id === profile?.id && link.status === 'active' && (
            <>
              <Field label="Permission to share">
                <select
                  className={inputClass}
                  value={scope}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  {[
                    'wellbeing_pulse',
                    'mood_trend',
                    'safety_alerts',
                    'trusted_contacts',
                    'safety_plan',
                    'referral_status',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {words(s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="button"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    const policy = await api<Policy>('/v1/policy')
                    await api('/v1/grants', {
                      method: 'POST',
                      body: {
                        link_id: link.id,
                        scope,
                        policy_version: policy.version,
                      },
                    })
                    grants.reload()
                  })
                }
              >
                Grant selected permission
              </Button>
            </>
          )}
          {grants.value
            ?.filter((g) => g.link_id === link.id && !g.revoked_at)
            .map((g) => (
              <div key={g.id} className="flex flex-wrap items-center gap-3">
                <span>{words(g.scope)}</span>
                {link.subject_id === profile?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await api(`/v1/grants/${g.id}`, { method: 'DELETE' })
                        grants.reload()
                      }, 'Permission revoked.')
                    }
                  >
                    Revoke permission
                  </Button>
                )}
              </div>
            ))}
          {link.status !== 'revoked' && (
            <Button
              type="button"
              variant="ghost"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Revoke this connection and all its permissions?',
                  )
                )
                  void action.run(async () => {
                    await api(`/v1/links/${link.id}`, { method: 'DELETE' })
                    links.reload()
                    grants.reload()
                  }, 'Connection revoked.')
              }}
            >
              Revoke connection
            </Button>
          )}
        </div>
      ))}
    </Panel>
  )
}
export function SupportRequestsPanel() {
  const remote = useRemote<SupportRequest[]>('/v1/support-requests', true)
  const action = useAction()
  return (
    <Panel>
      <h2 className="text-xl font-semibold">Support requests</h2>
      <p>
        Provider acceptance does not mean that the recipient has read the
        request.
      </p>
      <Button type="button" variant="ghost" onClick={remote.reload}>
        Refresh requests
      </Button>
      <Feedback {...action} />
      <RemoteState remote={remote} empty={!remote.value?.length} />
      {remote.value?.map((r) => (
        <div key={r.id} className="space-y-3 border-t border-line py-3">
          <p>
            {words(r.state)} · {date(r.created_at)}
          </p>
          <p className="text-sm">Expires {date(r.expires_at)}</p>
          {r.state === 'awaiting_permission' && (
            <Button
              type="button"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Send this support request to the selected contact?',
                  )
                )
                  void action.run(async () => {
                    await api(`/v1/support-requests/${r.id}/confirm`, {
                      method: 'POST',
                      body: { confirmed: 'yes', version: r.version },
                    })
                    remote.reload()
                  }, 'Request confirmed. Check its delivery state below.')
              }}
            >
              Confirm sending
            </Button>
          )}
          {['awaiting_permission', 'queued'].includes(r.state) && (
            <Button
              type="button"
              variant="ghost"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await api(`/v1/support-requests/${r.id}`, {
                    method: 'DELETE',
                  })
                  remote.reload()
                }, 'Cancelled.')
              }
            >
              Cancel request
            </Button>
          )}
        </div>
      ))}
    </Panel>
  )
}
export function SupportPage() {
  const resources = useRemote<SupportResource[]>('/v1/support-resources', true)
  const referrals = useRemote<Referral[]>('/v1/referrals', true)
  const action = useAction()
  return (
    <Screen
      title="Professional support"
      description="Reviewed resources and your own contact records. SOBA does not book appointments."
    >
      <Feedback {...action} />
      <RemoteState remote={resources} empty={!resources.value?.length} />
      {resources.value?.map((r) => (
        <Panel key={r.id}>
          <h2 className="text-xl font-semibold">{r.name}</h2>
          <p>
            {r.region} · {r.locale} · {r.availability_text}
          </p>
          <a
            className="underline"
            href={r.access_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit resource
          </a>
          {r.phone && (
            <a className="block underline" href={`tel:${r.phone}`}>
              {r.phone}
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api('/v1/referrals', {
                  method: 'POST',
                  body: { resource_id: r.id },
                })
                referrals.reload()
              })
            }
          >
            Add to my contact records
          </Button>
        </Panel>
      ))}
      <Panel>
        <h2 className="text-xl font-semibold">My contact records</h2>
        <RemoteState remote={referrals} empty={!referrals.value?.length} />
        {referrals.value?.map((r) => (
          <div key={r.id} className="space-y-3 border-t border-line py-3">
            <p>
              {resources.value?.find((x) => x.id === r.resource_id)?.name ??
                'Support resource'}
            </p>
            <Field label="Status reported by you">
              <select
                className={inputClass}
                disabled={action.busy}
                value={r.state}
                onChange={(e) =>
                  void action.run(async () => {
                    await api(`/v1/referrals/${r.id}`, {
                      method: 'PATCH',
                      body: { state: e.target.value, version: r.version },
                    })
                    referrals.reload()
                  })
                }
              >
                {[
                  'considering',
                  'contacted',
                  'appointment_reported',
                  'closed',
                ].map((s) => (
                  <option key={s} value={s}>
                    {words(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="button"
              variant="ghost"
              disabled={action.busy}
              onClick={() => {
                if (window.confirm('Delete this contact record?'))
                  void action.run(async () => {
                    await api(`/v1/referrals/${r.id}`, { method: 'DELETE' })
                    referrals.reload()
                  }, 'Deleted.')
              }}
            >
              Delete record
            </Button>
          </div>
        ))}
      </Panel>
    </Screen>
  )
}
export function AlertsPage() {
  const remote = useRemote<Alert[]>('/v1/alerts', true)
  const action = useAction()
  const [reach, setReach] = useState<ReachOut | null>(null)
  return (
    <Screen
      title="Safety alerts"
      description="Only alerts addressed to your account appear here."
    >
      <Button type="button" variant="secondary" onClick={remote.reload}>
        Refresh alerts
      </Button>
      <Feedback {...action} />
      <RemoteState remote={remote} empty={!remote.value?.length} />
      {remote.value?.map((a) => (
        <Panel key={a.id}>
          <h2 className="text-xl font-semibold">
            Check in with {a.subject_display_name}
          </h2>
          <p>
            {words(a.state)} · {date(a.created_at)}
          </p>
          <Button
            type="button"
            disabled={action.busy || a.state === 'acknowledged'}
            onClick={() =>
              void action.run(async () => {
                await api(`/v1/alerts/${a.id}/acknowledge`, { method: 'POST' })
                remote.reload()
              }, 'Acknowledged.')
            }
          >
            Acknowledge
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                setReach(await api<ReachOut>(`/v1/alerts/${a.id}/reach-out`))
              }, '')
            }
          >
            Contact options
          </Button>
        </Panel>
      ))}
      {reach && (
        <Panel>
          <h2 className="text-xl font-semibold">Reach out</h2>
          <p>{reach.message_template}</p>
          {reach.phone ? (
            <a className="underline" href={`tel:${reach.phone}`}>
              Call {reach.phone}
            </a>
          ) : (
            <p>No phone number has been shared.</p>
          )}
        </Panel>
      )}
    </Screen>
  )
}
