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
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 disabled:opacity-50',
          checked
            ? tone === 'sage'
              ? 'border-sage bg-sage'
              : 'border-apricot bg-apricot'
            : 'border-line bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
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
              'whitespace-nowrap rounded-xl font-medium transition-all duration-200',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              active
                ? 'bg-surface text-brown-dark shadow-card'
                : 'text-ink-secondary hover:text-brown-dark',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span className={cn('ml-1.5 text-xs', active ? 'text-apricot' : 'text-ink-muted')}>
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
            'absolute top-[calc(100%+8px)] z-50 min-w-[220px] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lift animate-scale-in',
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
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
        tone === 'danger'
          ? 'text-terracotta-dark hover:bg-terracotta-soft'
          : 'text-ink hover:bg-muted hover:text-brown-dark',
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
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-max max-w-[220px] -translate-x-1/2 rounded-xl bg-brown-dark px-3 py-2 text-xs font-medium leading-snug text-cream opacity-0 shadow-soft transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
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
    apricot: 'bg-apricot',
    sage: 'bg-sage',
    brown: 'bg-brown',
  }[tone]

  return (
    <div className={className}>
      {label || showValue ? (
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          {label ? <span className="text-ink-secondary">{label}</span> : <span />}
          {showValue ? <span className="text-brown-dark">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', toneClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
