import { useNavigate } from 'react-router-dom'
import { BookOpenText, MessageCircle, PhoneCall, Stethoscope, TriangleAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../../context/ToastContext'
import type { SafetyAlert } from '../../types'

interface SafetyAlertBannerProps {
  alert: SafetyAlert
  subjectName: string
  onAcknowledge?: () => void
}

/**
 * Urgency is carried by muted terracotta and clear hierarchy rather than
 * saturated red or motion — panic is not a useful state for a guardian.
 */
export function SafetyAlertBanner({ alert, subjectName, onAcknowledge }: SafetyAlertBannerProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  return (
    <section
      aria-labelledby="active-alert-title"
      className="rounded-3xl border border-terracotta/35 bg-terracotta-soft p-6 sm:p-7"
    >
      <div className="flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-terracotta text-white">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta-dark/70">
            Action recommended · {alert.date}
          </p>
          <h2 id="active-alert-title" className="mt-1.5 text-xl font-semibold text-terracotta-dark sm:text-2xl">
            {alert.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-terracotta-dark/85">
            {alert.description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        <Button
          variant="danger"
          size="lg"
          onClick={() => toast(`Opening your phone to call ${subjectName}`, { tone: 'warning' })}
        >
          <PhoneCall className="h-4 w-4" aria-hidden="true" />
          Call {subjectName}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => navigate('/app/guardian/reach-out')}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Send Message
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate('/app/guardian/coach')}>
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          View Support Guidance
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-terracotta/25 pt-4">
        <button
          type="button"
          onClick={() => navigate('/app/guardian/safety')}
          className="inline-flex items-center gap-2 text-sm font-medium text-terracotta-dark underline-offset-4 hover:underline"
        >
          <Stethoscope className="h-4 w-4" aria-hidden="true" />
          Professional support options
        </button>
        {onAcknowledge ? (
          <Button variant="ghost" size="sm" onClick={onAcknowledge}>
            Acknowledge alert
          </Button>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-terracotta-dark/70">
        Soba is not an emergency service. If there is immediate danger, contact emergency services on
        112.
      </p>
    </section>
  )
}
