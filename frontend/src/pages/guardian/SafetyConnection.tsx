import { CircleCheck, LockKeyhole, Phone, ShieldCheck, Users } from 'lucide-react'
import { PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { guardianConnectionStatus, guardianConsent } from '../../data/mockGuardian'
import { crisisResources } from '../../data/mockProfessionals'

export default function SafetyConnection() {
  const { user } = useAuth()
  const subject = user?.subjectName ?? 'Nara'

  return (
    <>
      <PageHeader
        title="Safety & Connection"
        description={`Who is connected to ${subject}, and exactly what each connection allows. You see only what ${subject} has consented to share.`}
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <SectionCard
          title="Circle of Trust overview"
          description="The people available to be reached, as configured by the person themselves."
          icon={<Users className="h-[18px] w-[18px]" />}
        >
          <ul className="space-y-3">
            {guardianConnectionStatus.map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-muted/40 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brown-dark">{item.label}</p>
                  <p className="mt-0.5 text-sm text-ink-secondary">{item.value}</p>
                </div>
                <Badge tone={item.status === 'active' ? 'sage' : 'neutral'}>
                  {item.status === 'active' ? 'Active' : 'Not shared'}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-ink-secondary">
            An empty section does not mean {subject} has no support. It means that section has not
            been shared with you.
          </p>
        </SectionCard>

        <SectionCard
          title="Consent status"
          description="What sharing is currently switched on."
          icon={<ShieldCheck className="h-[18px] w-[18px]" />}
        >
          <ul className="space-y-3">
            {guardianConsent.map((item) => (
              <li key={item.scope} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brown-dark">{item.scope}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{item.description}</p>
                  </div>
                  {item.shared ? (
                    <Badge tone="sage" icon={<CircleCheck className="h-3 w-3" />}>
                      Shared
                    </Badge>
                  ) : (
                    <Badge tone="neutral" icon={<LockKeyhole className="h-3 w-3" />}>
                      Not shared
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <PrivacyNote className="mt-5">
            {subject} can change or withdraw any of these at any time. You are not notified of the
            content, only that access has changed.
          </PrivacyNote>
        </SectionCard>
      </div>

      <Card padding="lg" className="mt-5">
        <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">Safety plan status</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          A safety plan is written by {subject}, for {subject}. You see whether one exists, not what
          it says.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-sage-soft px-5 py-4">
          <CircleCheck className="h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
          <p className="text-sm font-medium text-sage-deep">
            A safety plan exists and sharing with you is enabled for emergencies.
          </p>
        </div>
      </Card>

      <Card tone="cream" padding="lg" className="mt-5">
        <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">Emergency support resources</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Use these directly. Soba is not an emergency service and does not contact them for you.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {crisisResources.map((resource) => (
            <li key={resource.id} className="rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-terracotta-soft text-terracotta-dark">
                <Phone className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-3.5 text-sm font-semibold text-brown-dark">{resource.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{resource.detail}</p>
              <p className="mt-3 font-serif text-xl text-apricot">{resource.contact}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
