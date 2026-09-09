import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  tone?: 'apricot' | 'sage'
}

export function Toggle({ checked, onChange, label, description, disabled, tone = 'apricot' }: ToggleProps) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-brown-dark">
          {label}
        </label>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-full border transition-all duration-300 ease-soba disabled:opacity-50',
          checked
            ? tone === 'sage'
              ? 'border-sage bg-sage shadow-[0_2px_8px_rgba(124,144,112,0.35)]'
              : 'border-apricot bg-gradient-to-b from-apricot-400 to-apricot shadow-[0_2px_8px_rgba(212,149,77,0.35)]'
            : 'border-line bg-muted-deep',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(82,58,40,0.25)] transition-transform duration-300 ease-soba',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  )
}

interface TabsProps<T extends string> {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}

export function Tabs<T extends string>({ tabs, value, onChange, className, size = 'md' }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-line bg-muted p-1 no-scrollbar',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'whitespace-nowrap rounded-xl font-medium transition-all duration-200 ease-soba',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              active
                ? 'bg-surface text-brown-dark shadow-card'
                : 'text-ink-secondary hover:bg-surface/50 hover:text-brown-dark',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  active ? 'bg-apricot-100 text-apricot-800' : 'bg-line-soft text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

interface DropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
  label: string
}

export function Dropdown({ trigger, children, align = 'right', className, label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="rounded-2xl"
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            'absolute top-[calc(100%+10px)] z-50 min-w-[230px] origin-top overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-float animate-scale-in',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function DropdownItem({
  children,
  onClick,
  tone = 'default',
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150',
        tone === 'danger'
          ? 'text-terracotta-dark hover:bg-terracotta-soft'
          : 'text-ink hover:bg-cream hover:text-brown-dark',
      )}
    >
      {children}
    </button>
  )
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-max max-w-[220px] -translate-x-1/2 translate-y-1 rounded-xl bg-brown-dark px-3 py-2 text-xs font-medium leading-snug text-cream opacity-0 shadow-lift transition-all duration-200 ease-soba group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        {label}
        <span
          className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-brown-dark"
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

interface ProgressProps {
  value: number
  max?: number
  label?: string
  tone?: 'apricot' | 'sage' | 'brown'
  showValue?: boolean
  className?: string
}

export function Progress({ value, max = 100, label, tone = 'apricot', showValue, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const toneClass = {
    apricot: 'bg-gradient-to-r from-apricot-400 to-apricot',
    sage: 'bg-gradient-to-r from-sage to-sage-deep',
    brown: 'bg-gradient-to-r from-brown-400 to-brown',
  }[tone]

  return (
    <div className={className}>
      {label || showValue ? (
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          {label ? <span className="text-ink-secondary">{label}</span> : <span />}
          {showValue ? <span className="tabular text-brown-dark">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-muted-deep shadow-[inset_0_1px_2px_rgba(82,58,40,0.06)]"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-soba', toneClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Circular progress used for the guardian wellbeing pulse. */
export function RadialProgress({
  value,
  size = 176,
  stroke = 10,
  label,
  sublabel,
  tone = '#D4954D',
}: {
  value: number
  size?: number
  stroke?: number
  label: ReactNode
  sublabel?: string
  tone?: string
}) {
  // Unique per instance: a fixed id would make a second dial on the same page
  // reuse the first one's gradient, ignoring its own tone.
  const gradientId = `radial-${useId().replace(/:/g, '')}`
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, value)) / 100

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E9C99C" />
            <stop offset="100%" stopColor={tone} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDE6DB" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${pct * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-1000 ease-soba"
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        {label}
        {sublabel ? <span className="mt-0.5 text-xs text-ink-muted">{sublabel}</span> : null}
      </div>
    </div>
  )
}
