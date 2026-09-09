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
} from 'lucide-react'
import { AlertCard, EmptyState, PageHeader } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Avatar, Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { crisisResources, professionals } from '../../data/mockProfessionals'
import type { Professional } from '../../types'

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

export default function ProfessionalSupport() {
  const { toast } = useToast()
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
            label=""
            aria-label="Search professionals"
            placeholder="Search by name, city, or focus"
            icon={<Search className="h-4 w-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select label="" aria-label="Session mode" options={modeOptions} value={mode} onChange={(e) => setMode(e.target.value)} />
          <Select
            label=""
            aria-label="Specialization"
            options={specializationOptions}
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          />
          <Select
            label=""
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
                <Button
                  size="sm"
                  onClick={() =>
                    toast('Appointment request drafted', {
                      description: 'Nothing is sent until you confirm the details.',
                    })
                  }
                >
                  Request
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

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
                setSelected(null)
                toast('Appointment request drafted', {
                  description: 'You will confirm the time and details before anything is sent.',
                })
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
