import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { SobaBear, type BearPose } from '../ui/SobaBear'
import { cn } from '../../lib/cn'
import { Reveal } from '../ui/Brand'

interface PageHeroProps {
  eyebrow: string
  title: ReactNode
  description: string
  children?: ReactNode
  tone?: 'cream' | 'plain'
}

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  tone = 'cream',
}: PageHeroProps) {
  const { pathname } = useLocation()
  const poses: Record<string, BearPose> = {
    '/about': 'love',
    '/how-it-works': 'working',
    '/features': 'excited',
    '/safety': 'front',
    '/support': 'wave',
  }
  return (
    <section
      className={cn(
        'grain relative overflow-hidden border-b border-line py-16 lg:py-24',
        tone === 'cream' ? 'mesh-warm bg-cream/60' : 'bg-background',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-custard/40 blur-3xl"
      />
      <div className="container-soba relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        <Reveal className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-apricot">{eyebrow}</p>
          <h1 className="mt-4 heading-serif text-[38px] leading-[1.1] sm:text-[52px]">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
            {description}
          </p>
          {children ? <div className="mt-8">{children}</div> : null}
        </Reveal>
        <SobaBear
          pose={poses[pathname] ?? 'wave'}
          className="w-24 sm:w-36 lg:w-44"
        />
      </div>
    </section>
  )
}
