import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Info, ShieldCheck, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Card } from './Card'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-muted/40 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream text-brown">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-brown-dark">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

type AlertTone = 'info' | 'safety' | 'urgent' | 'privacy'

const alertTones: Record<AlertTone, { className: string; icon: LucideIcon }> = {
  info: { className: 'bg-cream border-custard/60 text-brown-dark', icon: Info },
  privacy: { className: 'bg-sage-soft border-sage/30 text-[#4A5C40]', icon: ShieldCheck },
  safety: { className: 'bg-amber-soft border-amber/30 text-[#7E6220]', icon: TriangleAlert },
  urgent: { className: 'bg-terracotta-soft border-terracotta/30 text-terracotta-dark', icon: TriangleAlert },
}

interface AlertCardProps {
  tone?: AlertTone
  title: string
  children?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  className?: string
}

export function AlertCard({ tone = 'info', title, children, action, icon, className }: AlertCardProps) {
  const config = alertTones[tone]
  const Icon = icon ?? config.icon
  return (
    <div className={cn('rounded-3xl border p-5 sm:p-6', config.className, className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
            {children ? <div className="mt-1.5 text-sm leading-relaxed opacity-90">{children}</div> : null}
          </div>
        </div>
        {action ? <div className="shrink-0 sm:pl-4">{action}</div> : null}
      </div>
    </div>
  )
}

interface PrivacyNoteProps {
  children: ReactNode
  className?: string
}

export function PrivacyNote({ children, className }: PrivacyNoteProps) {
  return (
    <p
      className={cn(
        'inline-flex items-start gap-2 rounded-2xl bg-sage-soft/70 px-3.5 py-2.5 text-xs leading-relaxed text-[#4A5C40]',
        className,
      )}
    >
      <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'surface' | 'cream' | 'custard' | 'brown'
  trend?: { label: string; direction: 'up' | 'down' | 'steady' }
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'surface', trend }: StatCardProps) {
  const dark = tone === 'brown'
  return (
    <Card
      tone={tone}
      padding="md"
      interactive
      className="group relative flex flex-col justify-between gap-5 overflow-hidden"
    >
      {/* Accent wash that warms on hover without moving anything */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-500',
          dark ? 'bg-custard/20' : 'bg-apricot/10',
          'opacity-0 group-hover:opacity-100',
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('text-sm font-medium', dark ? 'text-cream/80' : 'text-ink-secondary')}>{label}</p>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
            dark
              ? 'bg-cream/15 text-custard'
              : 'bg-cream text-brown group-hover:bg-apricot group-hover:text-white',
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="relative">
        <p
          className={cn(
            'text-[32px] font-semibold leading-none tracking-tight tabular-nums',
            dark ? 'text-cream' : 'text-brown-dark',
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className={cn('mt-2 text-xs leading-relaxed', dark ? 'text-cream/70' : 'text-ink-muted')}>
            {hint}
          </p>
        ) : null}
        {trend ? (
          <p
            className={cn(
              'mt-2 text-xs font-medium',
              trend.direction === 'up'
                ? 'text-sage'
                : trend.direction === 'down'
                  ? 'text-terracotta'
                  : 'text-ink-muted',
            )}
          >
            {trend.label}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  eyebrow?: string
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-line/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-apricot">{eyebrow}</p>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-brown-dark sm:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-secondary sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
