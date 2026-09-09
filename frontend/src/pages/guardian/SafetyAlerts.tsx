import { BellOff, ShieldCheck } from 'lucide-react'
import { EmptyState, PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { SafetyAlertBanner } from '../../components/dashboard/SafetyAlertBanner'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'

const severityTone = {
  urgent: 'terracotta',
  elevated: 'amber',
  info: 'cream',
} as const

export default function SafetyAlerts() {
  const { user } = useAuth()
  const { alerts, acknowledgeAlert, resolveAlert } = useAppData()
  const { toast } = useToast()
  const subject = user?.subjectName ?? 'Nara'

  const open = alerts.filter((alert) => alert.status !== 'resolved')
  const history = alerts.filter((alert) => alert.status === 'resolved')

  return (
    <>
      <PageHeader
        title="Safety Alerts"
        description="A record of moments where Soba recommended a check-in. No conversation content is ever included."
      />

      {open.length === 0 ? (
        <Card tone="cream" padding="none" className="mb-6">
          <EmptyState
            icon={ShieldCheck}
            title="Nothing currently requires urgent attention"
            description={`Soba has not flagged anything for ${subject}. Alerts appear here only when a check-in is recommended.`}
            className="border-none bg-transparent"
          />
        </Card>
      ) : (
        <div className="mb-6 space-y-4">
          {open.map((alert) =>
            alert.status === 'open' ? (
              <SafetyAlertBanner
                key={alert.id}
                alert={alert}
                subjectName={subject}
                onAcknowledge={() => {
                  acknowledgeAlert(alert.id)
                  toast('Alert acknowledged', { description: 'It stays open until you mark it resolved.' })
                }}
              />
            ) : (
              <Card key={alert.id} tone="terracotta" padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="amber">Acknowledged</Badge>
                      <span className="text-xs text-ink-muted">{alert.date}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-terracotta-dark">{alert.title}</h2>
                    <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-terracotta-dark/85">
                      {alert.description}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      resolveAlert(alert.id)
                      toast('Alert resolved')
                    }}
                  >
                    Mark resolved
                  </Button>
                </div>
              </Card>
            ),
          )}
        </div>
      )}

      <Card padding="lg">
        <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Alert history</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Past alerts and how they were closed. Confidential conversation is never exposed here.
        </p>

        {history.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={BellOff}
              title="No past alerts"
              description="Resolved alerts will be listed here for your reference."
            />
          </div>
        ) : (
          <>
            {/* Table on larger screens */}
            <div className="mt-5 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">History of resolved safety alerts</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th scope="col" className="pb-3 pr-4 font-semibold">Date</th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">Alert</th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">Level</th>
                    <th scope="col" className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map((alert) => (
                    <tr key={alert.id}>
                      <th scope="row" className="py-4 pr-4 text-left font-medium text-brown-dark">
                        {alert.date}
                      </th>
                      <td className="py-4 pr-4 text-ink-secondary">{alert.title}</td>
                      <td className="py-4 pr-4">
                        <Badge tone={severityTone[alert.severity]}>
                          {alert.severity === 'urgent'
                            ? 'Urgent'
                            : alert.severity === 'elevated'
                              ? 'Elevated'
                              : 'Informational'}
                        </Badge>
                      </td>
                      <td className="py-4">
                        <Badge tone="sage">Resolved</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on mobile */}
            <ul className="mt-5 space-y-3 sm:hidden">
              {history.map((alert) => (
                <li key={alert.id} className="rounded-2xl border border-line bg-muted/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-ink-muted">{alert.date}</span>
                    <Badge tone="sage">Resolved</Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-brown-dark">{alert.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{alert.description}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <PrivacyNote className="mt-6">
        An alert tells you that a check-in is recommended. It never tells you what was said.
      </PrivacyNote>
    </>
  )
}
