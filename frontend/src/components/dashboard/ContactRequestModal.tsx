import { useEffect, useState } from 'react'
import { ArrowLeft, Check, LockKeyhole, Phone, Send, ShieldCheck } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Avatar, Badge } from '../ui/Badge'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import type { TrustedContact } from '../../types'

interface ContactRequestModalProps {
  open: boolean
  onClose: () => void
  contacts: TrustedContact[]
  preselectedId?: string
}

const FIXED_MESSAGE =
  'Nara has asked Soba to let you know they would like to talk. No details about the conversation have been shared.'

/**
 * Contact request (C7). The recipient, the exact message, and everything that
 * is *not* attached are all shown before the confirm step — nothing sends on
 * selection alone.
 */
export function ContactRequestModal({
  open,
  onClose,
  contacts,
  preselectedId,
}: ContactRequestModalProps) {
  const { createSupportRequest, advanceSupportRequest, supportRequests } = useAppData()
  const { toast } = useToast()
  const [step, setStep] = useState<'select' | 'preview' | 'status'>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sharePhone, setSharePhone] = useState(true)
  const [requestId, setRequestId] = useState<string | null>(null)

  const linkable = contacts.filter((contact) => contact.status === 'active')
  const selected = contacts.find((contact) => contact.id === selectedId) ?? null
  const request = supportRequests.find((item) => item.id === requestId) ?? null

  useEffect(() => {
    if (!open) return
    setStep('select')
    setSelectedId(preselectedId ?? null)
    setSharePhone(true)
    setRequestId(null)
  }, [open, preselectedId])

  // Simulated delivery progression, so each state in the spec is observable.
  useEffect(() => {
    if (!requestId || step !== 'status') return
    const accepted = window.setTimeout(() => advanceSupportRequest(requestId, 'accepted'), 1400)
    const acknowledged = window.setTimeout(() => advanceSupportRequest(requestId, 'acknowledged'), 4200)
    return () => {
      window.clearTimeout(accepted)
      window.clearTimeout(acknowledged)
    }
  }, [requestId, step, advanceSupportRequest])

  function handleSend() {
    if (!selected) return
    const id = createSupportRequest({
      contactId: selected.id,
      contactName: selected.name,
      relationship: selected.relationship,
      sharedPhone: sharePhone ? selected.phone : undefined,
      message: FIXED_MESSAGE,
    })
    setRequestId(id)
    setStep('status')
    toast(`Request sent to ${selected.name}`, { description: 'Only the request itself was shared.' })
  }

  const statusCopy: Record<string, { label: string; detail: string; tone: 'amber' | 'sage' | 'neutral' }> = {
    queued: { label: 'Queued', detail: 'The request is waiting to be delivered.', tone: 'amber' },
    accepted: {
      label: 'Accepted by service',
      detail: 'The delivery service has taken the request. This does not mean it has been read.',
      tone: 'amber',
    },
    acknowledged: {
      label: 'Acknowledged',
      detail: `${selected?.name ?? 'They'} opened the request. This does not confirm anything beyond that.`,
      tone: 'sage',
    },
    cancelled: { label: 'Cancelled', detail: 'You cancelled this request.', tone: 'neutral' },
    expired: { label: 'Expired', detail: 'The request was not picked up in time.', tone: 'neutral' },
    failed: { label: 'Failed', detail: 'The request could not be delivered. You can try again.', tone: 'neutral' },
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        step === 'select'
          ? 'Ask someone to reach out'
          : step === 'preview'
            ? 'Confirm what is shared'
            : 'Request status'
      }
      description={
        step === 'select'
          ? 'Soba can let someone in your circle know you would like to talk.'
          : step === 'preview'
            ? 'Nothing has been sent yet. This is exactly what they will receive.'
            : undefined
      }
      footer={
        step === 'select' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!selected} onClick={() => setStep('preview')}>
              Review request
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="ghost" onClick={() => setStep('select')}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button onClick={handleSend} data-autofocus>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send request
            </Button>
          </>
        ) : (
          <>
            {request && (request.status === 'queued' || request.status === 'accepted') ? (
              <Button
                variant="ghost"
                onClick={() => {
                  advanceSupportRequest(request.id, 'cancelled')
                  toast('Request cancelled', { tone: 'info' })
                }}
              >
                Cancel request
              </Button>
            ) : null}
            <Button onClick={onClose} data-autofocus>
              Done
            </Button>
          </>
        )
      }
    >
      {step === 'select' ? (
        linkable.length === 0 ? (
          <p className="rounded-2xl bg-muted px-4 py-6 text-center text-sm leading-relaxed text-ink-secondary">
            No one in your circle has accepted an invitation yet. You can still call or message
            someone directly from the Circle of Trust page.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {linkable.map((contact) => {
              const isSelected = selectedId === contact.id
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(contact.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors',
                      isSelected
                        ? 'border-apricot bg-apricot-soft/50'
                        : 'border-line hover:border-apricot/40 hover:bg-cream/50',
                    )}
                  >
                    <Avatar initials={contact.avatarInitials} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-brown-dark">{contact.name}</span>
                      <span className="block text-xs text-ink-secondary">{contact.relationship}</span>
                    </span>
                    {isSelected ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-apricot text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      {step === 'preview' && selected ? (
        <div className="space-y-5">
          <div className="rounded-3xl border border-line bg-cream/60 p-5">
            <p className="text-xs font-medium text-ink-muted">Recipient</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Avatar initials={selected.avatarInitials} size="lg" />
              <div>
                <p className="text-base font-semibold text-brown-dark">{selected.name}</p>
                <p className="text-sm text-ink-secondary">{selected.relationship}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-muted">They will receive exactly this</p>
            <p className="mt-2 rounded-2xl bg-brown px-4 py-3.5 text-sm leading-relaxed text-cream">
              {FIXED_MESSAGE}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSharePhone((value) => !value)}
            aria-pressed={sharePhone}
            className={cn(
              'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
              sharePhone ? 'border-apricot bg-apricot-soft/50' : 'border-line hover:bg-cream/50',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2',
                sharePhone ? 'border-apricot bg-apricot text-white' : 'border-line',
              )}
            >
              {sharePhone ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-brown-dark">
                <Phone className="h-4 w-4 text-brown-soft" aria-hidden="true" />
                Include my phone number
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-secondary">
                Optional. Without it they can still reply inside Soba.
              </span>
            </span>
          </button>

          <div className="rounded-2xl border border-line bg-muted/50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold text-brown-dark">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Not attached to this request
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {['Your conversation', 'Your journal', 'Your mood trend', 'Any safety classification'].map(
                (item) => (
                  <li key={item} className="text-xs text-ink-secondary">
                    · {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">
            This request expires after 30 minutes if it is not picked up.
          </p>
        </div>
      ) : null}

      {step === 'status' && request ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-5 py-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brown-dark">{request.contactName}</p>
              <p className="text-xs text-ink-muted">Sent at {request.createdAt}</p>
            </div>
            <Badge tone={statusCopy[request.status]?.tone ?? 'neutral'} size="md">
              {statusCopy[request.status]?.label ?? request.status}
            </Badge>
          </div>

          <p className="text-sm leading-relaxed text-ink-secondary">
            {statusCopy[request.status]?.detail}
          </p>

          <ol className="space-y-2.5">
            {(['queued', 'accepted', 'acknowledged'] as const).map((state, index) => {
              const order = ['queued', 'accepted', 'acknowledged']
              const currentIndex = order.indexOf(request.status)
              const done = currentIndex >= index && currentIndex !== -1
              return (
                <li key={state} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                      done ? 'bg-sage text-white' : 'bg-muted text-ink-muted',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className={cn('text-sm', done ? 'text-brown-dark' : 'text-ink-muted')}>
                    {statusCopy[state].label}
                  </span>
                </li>
              )
            })}
          </ol>

          <p className="inline-flex items-start gap-2 rounded-2xl bg-sage-soft px-3.5 py-2.5 text-xs leading-relaxed text-sage-deep">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Acknowledged means the request was opened. It is not a confirmation that anyone is safe
            or that a conversation happened.
          </p>
        </div>
      ) : null}
    </Modal>
  )
}
