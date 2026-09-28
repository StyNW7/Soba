import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleDot, Cloud, CloudRain, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { MoodLabel } from '../../types'

interface LogoProps {
  to?: string
  className?: string
  variant?: 'dark' | 'light'
  showWordmark?: boolean
}

export function Logo({ to = '/', className, variant = 'dark', showWordmark = true }: LogoProps) {
  const content = (
    <span
      role="img"
      aria-label="Soba"
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-xl px-2 py-1',
        variant === 'light' && 'shadow-sm',
        className,
      )}
    >
      <svg viewBox="355 163 558 580" className="h-10 w-10 shrink-0" aria-hidden="true">
        <image href="/images/brand/soba-logo.png" width="1254" height="1254" />
      </svg>
      {showWordmark ? (
        <svg viewBox="300 750 663 235" className="h-7 w-20" aria-hidden="true">
          <image href="/images/brand/soba-logo.png" width="1254" height="1254" />
        </svg>
      ) : null}
    </span>
  )

  if (!to) return content
  return (
    <Link to={to} aria-label="Soba home" className="rounded-2xl">
      {content}
    </Link>
  )
}

export const moodIcons: Record<MoodLabel, LucideIcon> = {
  Calm: Sun,
  Okay: CircleDot,
  Tired: Moon,
  Stressed: Cloud,
  Overwhelmed: CloudRain,
}

export const moodTone: Record<MoodLabel, string> = {
  Calm: 'text-apricot',
  Okay: 'text-brown',
  Tired: 'text-brown-soft',
  Stressed: 'text-amber',
  Overwhelmed: 'text-terracotta',
}

export function MoodIcon({ mood, className }: { mood: MoodLabel; className?: string }) {
  const Icon = moodIcons[mood]
  return <Icon className={cn('h-4 w-4', moodTone[mood], className)} aria-hidden="true" />
}

interface RevealProps {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article'
}

/** Fades content up once it enters the viewport. Respects reduced motion via CSS. */
export function Reveal({ children, delay = 0, className, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      className={cn(
        'transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)]',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: string
  align?: 'left' | 'center'
  tone?: 'dark' | 'light'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'dark',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            'mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow',
            tone === 'dark' ? 'text-apricot-700' : 'text-custard',
            align === 'center' && 'justify-center',
          )}
        >
          <span
            className={cn(
              'h-px w-6',
              tone === 'dark' ? 'bg-apricot-300' : 'bg-custard/50',
            )}
            aria-hidden="true"
          />
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'heading-serif text-[34px] leading-[1.12] sm:text-[44px] lg:text-[48px]',
          tone === 'light' && 'text-cream',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-5 text-base leading-relaxed sm:text-[17px]',
            tone === 'dark' ? 'text-ink-secondary' : 'text-cream/75',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
