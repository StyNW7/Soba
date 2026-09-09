import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Reveal } from '../ui/Brand'

interface PageHeroProps {
  eyebrow: string
  title: ReactNode
  description: string
  children?: ReactNode
  tone?: 'cream' | 'plain'
}

export function PageHero({ eyebrow, title, description, children, tone = 'cream' }: PageHeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden border-b border-line py-16 lg:py-24',
        tone === 'cream' ? 'bg-cream/60' : 'bg-background',
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-[380px] w-[380px] rounded-full bg-custard/40 blur-3xl"
      />
      <div className="container-soba relative">
        <Reveal className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-apricot">{eyebrow}</p>
          <h1 className="mt-4 heading-serif text-[38px] leading-[1.1] sm:text-[52px]">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
            {description}
          </p>
          {children ? <div className="mt-8">{children}</div> : null}
        </Reveal>
      </div>
    </section>
  )
}
