import { useMemo, useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  Filter,
  Globe,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  Trash2,
} from 'lucide-react'
import { AlertCard, EmptyState, PageHeader } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { crisisResources, professionals } from '../../data/mockProfessionals'
import type { Professional, Referral } from '../../types'

const modeOptions = [
  { value: 'all', label: 'Online and in-person' },
  { value: 'online', label: 'Online only' },
  { value: 'in-person', label: 'In-person only' },
]

const specializationOptions = [
  { value: 'all', label: 'All specializations' },
  { value: 'Anxiety', label: 'Anxiety' },
  { value: 'Academic stress', label: 'Academic stress' },
  { value: 'Sleep', label: 'Sleep' },
  { value: 'Burnout', label: 'Burnout' },
  { value: 'Family communication', label: 'Family communication' },
]

const languageOptions = [
  { value: 'all', label: 'Any language' },
  { value: 'Indonesian', label: 'Indonesian' },
  { value: 'English', label: 'English' },
]

const referralStatusOptions = [
  { value: 'reported-by-you', label: 'Reported by you' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'closed', label: 'Closed' },
]

export default function ProfessionalSupport() {
  const { toast } = useToast()
  const { referrals, createReferral, updateReferral, removeReferral } = useAppData()
  const [requestFor, setRequestFor] = useState<Professional | null>(null)
  const [note, setNote] = useState('')
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('all')
  const [specialization, setSpecialization] = useState('all')
  const [language, setLanguage] = useState('all')
  const [selected, setSelected] = useState<Professional | null>(null)

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return professionals.filter((professional) => {
      const matchesQuery =
        !normalized ||
        professional.name.toLowerCase().includes(normalized) ||
        professional.location.toLowerCase().includes(normalized) ||
        professional.specializations.some((item) => item.toLowerCase().includes(normalized))
      const matchesMode =
        mode === 'all' || professional.mode === mode || professional.mode === 'both'
      const matchesSpec =
        specialization === 'all' || professional.specializations.includes(specialization)
      const matchesLanguage = language === 'all' || professional.languages.includes(language)
      return matchesQuery && matchesMode && matchesSpec && matchesLanguage
    })
  }, [query, mode, specialization, language])

  return (
    <>
      <PageHeader
        title="Professional Support"
        description="Reviewed practitioners you can reach directly. Soba does not book on your behalf without your confirmation."
      />

      <AlertCard
        tone="urgent"
        title="Need support now?"
        className="mb-5"
        action={
          <Button variant="danger" onClick={() => toast('Opening emergency contacts', { tone: 'warning' })}>
            <Phone className="h-4 w-4" aria-hidden="true" />
            Crisis resources
          </Button>
        }
      >
        Soba is not an emergency service. If there is immediate risk, contact emergency services on
        112, or the SEJIWA support line on 119 extension 8.
      </AlertCard>

      <Card padding="md" className="mb-5">
        <div className="grid gap-3 lg:grid-cols-4">
          <Input
            aria-label="Search professionals"
            placeholder="Search by name, city, or focus"
            icon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select aria-label="Session mode" options={modeOptions} value={mode} onChange={(e) => setMode(e.target.value)} />
          <Select
            aria-label="Specialization"
            options={specializationOptions}
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          />
          <Select
            aria-label="Language"
            options={languageOptions}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          {results.length} of {professionals.length} practitioners match your filters
        </p>
      </Card>

      {results.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No practitioners match those filters"
          description="Try widening the specialization or language filter. The directory is small during the pilot."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((professional) => (
            <Card key={professional.id} padding="lg" className="flex h-full flex-col">
              <div className="flex items-start gap-3.5">
                <Avatar initials={professional.avatarInitials} size="lg" tone="cream" />
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 truncate text-base font-semibold text-brown-dark">
                    {professional.name}
                    {professional.verified ? (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-sage" aria-label="Reviewed practitioner" />
                    ) : null}
                  </h2>
                  <p className="text-sm text-ink-secondary">{professional.role}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {professional.specializations.map((spec) => (
                  <Badge key={spec} tone="cream">
                    {spec}
                  </Badge>
                ))}
              </div>

              <dl className="mt-5 space-y-2 text-sm text-ink-secondary">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <dd>
                    {professional.location} ·{' '}
                    {professional.mode === 'both' ? 'Online & in-person' : professional.mode === 'online' ? 'Online' : 'In-person'}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <dd>{professional.languages.join(', ')}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <dd>Next availability {professional.nextAvailable}</dd>
                </div>
              </dl>

              <div className="mt-auto grid grid-cols-2 gap-2.5 border-t border-line pt-4">
                <Button variant="secondary" size="sm" onClick={() => setSelected(professional)}>
                  View profile
                </Button>
                <Button size="sm" onClick={() => setRequestFor(professional)}>
                  Request
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Referrals the user has recorded themselves (U7) */}
      <SectionCard
        title="Your referrals"
        description="A record you keep for yourself. Soba does not contact practitioners on your behalf, and a status here is reported by you."
        className="mt-6"
      >
        {referrals.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 px-4 py-6 text-center text-sm leading-relaxed text-ink-secondary">
            No referrals yet. When you request an appointment, it is listed here so you can track it
            in your own words.
          </p>
        ) : (
          <ul className="space-y-3">
            {referrals.map((referral) => (
              <li
                key={referral.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-muted/40 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brown-dark">{referral.professionalName}</p>
                  <p className="text-xs text-ink-secondary">{referral.role}</p>
                  {referral.note ? (
                    <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{referral.note}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-muted">Recorded {referral.createdAt}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    aria-label={`Status for ${referral.professionalName}`}
                    options={referralStatusOptions}
                    value={referral.status}
                    onChange={(event) =>
                      updateReferral(referral.id, event.target.value as Referral['status'])
                    }
                    className="h-10 w-[170px]"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove referral for ${referral.professionalName}`}
                    onClick={() => {
                      removeReferral(referral.id)
                      toast('Referral removed', { tone: 'info' })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">
          Closing a referral records that you are done tracking it. It does not mean treatment is
          complete.
        </p>
      </SectionCard>

      {/* Request appointment */}
      <Modal
        open={Boolean(requestFor)}
        onClose={() => setRequestFor(null)}
        title={requestFor ? `Request an appointment with ${requestFor.name}` : ''}
        description="Nothing is sent automatically. This records the request so you can follow it up."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequestFor(null)}>
              Cancel
            </Button>
            <Button
              data-autofocus
              onClick={() => {
                if (!requestFor) return
                createReferral({
                  professionalId: requestFor.id,
                  professionalName: requestFor.name,
                  role: requestFor.role,
                  requestedFor: 'Myself',
                  note: note.trim() || undefined,
                })
                setRequestFor(null)
                setNote('')
                toast('Referral recorded', {
                  description: 'Contact details are shown so you can reach out directly.',
                })
              }}
            >
              Record request
            </Button>
          </>
        }
      >
        {requestFor ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 rounded-2xl bg-cream px-4 py-3.5">
              <Avatar initials={requestFor.avatarInitials} size="lg" tone="cream" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brown-dark">{requestFor.name}</p>
                <p className="text-xs text-ink-secondary">
                  {requestFor.role} · Next availability {requestFor.nextAvailable}
                </p>
              </div>
            </div>

            <Textarea
              label="Anything you want to remember about this (optional)"
              placeholder="Prefer an evening appointment."
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={300}
              hint="Kept privately in your own referral list. It is not sent to the practitioner."
            />

            <p className="rounded-2xl bg-muted px-4 py-3 text-xs leading-relaxed text-ink-secondary">
              Soba does not share your journal, conversations, mood history, or any safety
              classification with a practitioner. Availability shown is indicative and confirmed by
              the practitioner, not by Soba.
            </p>
          </div>
        ) : null}
      </Modal>

      <Card tone="cream" padding="lg" className="mt-6">
        <h2 className="text-base font-semibold text-brown-dark">Crisis and urgent support</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {crisisResources.map((resource) => (
            <li key={resource.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-brown-dark">{resource.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{resource.detail}</p>
              <p className="mt-3 font-serif text-xl text-apricot">{resource.contact}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        description={selected?.role}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              data-autofocus
              onClick={() => {
                setRequestFor(selected)
                setSelected(null)
              }}
            >
              Request appointment
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar initials={selected.avatarInitials} size="lg" />
              <div>
                <p className="text-sm text-ink-secondary">{selected.yearsExperience} years of practice</p>
                <p className="text-sm text-ink-secondary">{selected.location}</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brown-dark">Focus areas</h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selected.specializations.map((spec) => (
                  <Badge key={spec} tone="apricot">
                    {spec}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brown-dark">Availability</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Next opening {selected.nextAvailable}. Availability shown is indicative and confirmed
                by the practitioner, not by Soba.
              </p>
            </div>
            <p className="rounded-2xl bg-muted px-4 py-3 text-xs leading-relaxed text-ink-secondary">
              Soba shares only what you approve when you make a request. Your journal, conversations,
              and mood history are not attached.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
