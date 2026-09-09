import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'apricot' | 'brown' | 'sage' | 'amber' | 'terracotta' | 'cream'

const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-secondary border-line',
  cream: 'bg-cream text-brown-dark border-custard/55',
  apricot: 'bg-apricot-100 text-apricot-800 border-apricot-300/50',
  brown: 'bg-brown text-cream border-brown-900/30',
  sage: 'bg-sage-soft text-sage-deep border-sage/30',
  amber: 'bg-amber-soft text-amber-deep border-amber/30',
  terracotta: 'bg-terracotta-soft text-terracotta-dark border-terracotta/30',
}

const dotTones: Record<Tone, string> = {
  neutral: 'bg-ink-muted',
  cream: 'bg-brown-400',
  apricot: 'bg-apricot',
  brown: 'bg-custard',
  sage: 'bg-sage',
  amber: 'bg-amber',
  terracotta: 'bg-terracotta',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
  size?: 'sm' | 'md'
  /** Shows a status dot instead of an icon. */
  dot?: boolean
  /** Softly pulses the dot, for a live or pending state. */
  pulse?: boolean
}

export function Badge({
  children,
  tone = 'neutral',
  icon,
  className,
  size = 'sm',
  dot,
  pulse,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          {pulse ? (
            <span
              className={cn('absolute inset-0 animate-ping rounded-full opacity-60', dotTones[tone])}
            />
          ) : null}
          <span className={cn('relative h-1.5 w-1.5 rounded-full', dotTones[tone])} />
        </span>
      ) : (
        icon
      )}
      {children}
    </span>
  )
}

interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'brown' | 'apricot' | 'cream'
  className?: string
  /** Small status ring at the bottom-right. */
  status?: 'online' | 'offline'
}

const avatarSizes = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-16 w-16 text-lg',
}

const avatarTones = {
  brown: 'bg-gradient-to-br from-brown-500 to-brown-800 text-cream',
  apricot: 'bg-gradient-to-br from-apricot-400 to-apricot-700 text-white',
  cream: 'bg-gradient-to-br from-cream to-cream-deep text-brown-dark border border-custard/60',
}

export function Avatar({ initials, size = 'md', tone = 'brown', className, status }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold tracking-wide shadow-inset',
          avatarSizes[size],
          avatarTones[tone],
        )}
        aria-hidden="true"
      >
        {initials}
      </span>
      {status ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface',
            status === 'online' ? 'bg-sage' : 'bg-ink-faint',
          )}
          aria-hidden="true"
        />
      ) : null}
    </span>
  )
}
