import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SobaBear, type BearPose } from './SobaBear'
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
  bear?: BearPose
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  bear,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'dot-grid relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-line-strong/60 bg-muted/30 px-6 py-16 text-center',
        className,
      )}
    >
      {/* Soft halo keeps the dotted field from feeling like a broken layout */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background blur-2xl"
      />
      {bear ? (
        <SobaBear pose={bear} className="relative w-24" />
      ) : (
        <span className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      )}
      <h3 className="relative mt-5 text-base font-semibold text-brown-dark">
        {title}
      </h3>
      <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">
        {description}
      </p>
      {action ? <div className="relative mt-6">{action}</div> : null}
    </div>
  )
}

type AlertTone = 'info' | 'safety' | 'urgent' | 'privacy'

const alertTones: Record<AlertTone, { className: string; accent: string; icon: LucideIcon }> = {
  info: { className: 'bg-cream border-custard/55 text-brown-dark', accent: 'bg-brown-400', icon: Info },
  privacy: { className: 'bg-sage-soft border-sage/30 text-sage-deep', accent: 'bg-sage', icon: ShieldCheck },
  safety: { className: 'bg-amber-soft border-amber/30 text-amber-deep', accent: 'bg-amber', icon: TriangleAlert },
  urgent: {
    className: 'bg-terracotta-soft border-terracotta/30 text-terracotta-dark',
    accent: 'bg-terracotta',
    icon: TriangleAlert,
  },
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
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border p-5 pl-6 sm:p-6 sm:pl-7',
        config.className,
        className,
      )}
    >
      {/* Left accent bar carries the severity without relying on colour alone */}
      <span className={cn('absolute inset-y-0 left-0 w-1', config.accent)} aria-hidden="true" />
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
        'inline-flex items-start gap-2 rounded-2xl border border-sage/20 bg-sage-soft/70 px-3.5 py-2.5 text-xs leading-relaxed text-sage-deep',
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
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-500',
          dark ? 'bg-custard/25' : 'bg-apricot/12',
          'opacity-0 group-hover:opacity-100',
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('text-sm font-medium', dark ? 'text-cream/80' : 'text-ink-secondary')}>{label}</p>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ease-soba',
            dark
              ? 'bg-cream/15 text-custard'
              : 'bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset group-hover:from-apricot-400 group-hover:to-apricot group-hover:text-white group-hover:shadow-apricot-glow',
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div className="relative">
        <p
          className={cn(
            'tabular text-[34px] font-semibold leading-none tracking-headline',
            dark ? 'text-cream' : 'text-brown-dark',
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className={cn('mt-2.5 text-xs leading-relaxed', dark ? 'text-cream/70' : 'text-ink-muted')}>
            {hint}
          </p>
        ) : null}
        {trend ? (
          <p
            className={cn(
              'mt-2 text-xs font-medium',
              trend.direction === 'up'
                ? 'text-sage-deep'
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

const pageBears: Record<string, BearPose> = {
  '/app/user': 'wave',
  '/app/user/soba': 'threeQuarter',
  '/app/user/mood': 'neutral',
  '/app/user/journal': 'reading',
  '/app/user/toolkit': 'sleeping',
  '/app/user/circle': 'love',
  '/app/user/support': 'love',
  '/app/user/device': 'front',
  '/app/user/personalization': 'wink',
  '/app/user/privacy': 'back',
  '/app/user/settings': 'working',
  '/app/guardian': 'love',
  '/app/guardian/wellbeing': 'side',
  '/app/guardian/trends': 'thinking',
  '/app/guardian/coach': 'reading',
  '/app/guardian/settings': 'working',
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: PageHeaderProps) {
  const { pathname } = useLocation()
  const pose = pageBears[pathname]
  return (
    <header className="relative mb-8 flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <span
        className="divider-fade absolute inset-x-0 bottom-0"
        aria-hidden="true"
      />
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        {pose && <SobaBear pose={pose} className="w-14 sm:w-20" />}
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
          <h1 className="text-[30px] font-semibold leading-[1.12] tracking-headline text-brown-dark sm:text-[36px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-secondary sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
