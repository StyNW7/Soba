import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'surface' | 'cream' | 'custard' | 'brown' | 'muted' | 'terracotta'
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const tones = {
  surface: 'bg-surface border-line',
  cream: 'bg-cream border-custard/50',
  custard: 'bg-custard/50 border-custard',
  brown: 'bg-brown text-cream border-brown-dark/40',
  muted: 'bg-muted border-line',
  terracotta: 'bg-terracotta-soft border-terracotta/25',
}

const paddings = {
  none: '',
  sm: 'p-4 sm:p-5',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export function Card({
  tone = 'surface',
  interactive,
  padding = 'md',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border shadow-card transition-all duration-300',
        tones[tone],
        paddings[padding],
        interactive && 'hover:-translate-y-0.5 hover:shadow-soft',
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-brown">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-brown-dark">{title}</h2>
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
