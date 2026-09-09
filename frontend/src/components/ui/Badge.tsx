import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'neutral' | 'apricot' | 'brown' | 'sage' | 'amber' | 'terracotta' | 'cream'

const tones: Record<Tone, string> = {
  neutral: 'bg-muted text-ink-secondary border-line',
  cream: 'bg-cream text-brown-dark border-custard/60',
  apricot: 'bg-apricot-soft text-brown-dark border-apricot/30',
  brown: 'bg-brown text-cream border-brown-dark/30',
  sage: 'bg-sage-soft text-[#4F6244] border-sage/30',
  amber: 'bg-amber-soft text-[#8A6A22] border-amber/30',
  terracotta: 'bg-terracotta-soft text-terracotta-dark border-terracotta/30',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
  className?: string
  size?: 'sm' | 'md'
}

export function Badge({ children, tone = 'neutral', icon, className, size = 'sm' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'brown' | 'apricot' | 'cream'
  className?: string
}

const avatarSizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
}

const avatarTones = {
  brown: 'bg-brown text-cream',
  apricot: 'bg-apricot text-white',
  cream: 'bg-cream text-brown-dark border border-custard',
}

export function Avatar({ initials, size = 'md', tone = 'brown', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide',
        avatarSizes[size],
        avatarTones[tone],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
