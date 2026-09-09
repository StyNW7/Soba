import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'surface' | 'cream' | 'custard' | 'brown' | 'muted' | 'terracotta'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** Adds a light sweep on hover. Only meaningful with `interactive`. */
  sheen?: boolean
}

const tones = {
  /* A near-invisible top highlight gives flat cards a slight convex read. */
  surface: 'bg-surface border-line shadow-inset',
  cream: 'bg-cream border-custard/45',
  custard: 'bg-custard/45 border-custard-deep/40',
  brown: 'bg-gradient-to-br from-brown-600 to-brown-800 text-cream border-brown-900/30',
  muted: 'bg-muted border-line',
  terracotta: 'bg-terracotta-soft border-terracotta/25',
}

const paddings = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-7 lg:p-8',
}

export function Card({
  tone = 'surface',
  interactive,
  padding = 'md',
  sheen,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border shadow-card transition-all duration-300 ease-soba',
        tones[tone],
        paddings[padding],
        interactive && 'hover:-translate-y-1 hover:border-apricot-200 hover:shadow-lift',
        sheen && 'sheen',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface SectionCardProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  tone?: CardProps['tone']
  icon?: ReactNode
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  tone = 'surface',
  icon,
}: SectionCardProps) {
  return (
    <Card tone={tone} padding="lg" className={className}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          {icon ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Card>
  )
}

/** Section title used directly on the page background, outside a card. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <h2 className="rule-accent text-lg font-semibold tracking-headline text-brown-dark">
        {children}
      </h2>
      {action ? <div className="shrink-0 pb-1">{action}</div> : null}
    </div>
  )
}
