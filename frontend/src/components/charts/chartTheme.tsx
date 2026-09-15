import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from '../ui/Card'

export const chartColors = {
  apricot: '#D4954D',
  apricotLight: '#E9C99C',
  brown: '#775533',
  custard: '#E3DEA4',
  brownSoft: '#A98970',
  terracotta: '#B5654F',
  sage: '#7C9070',
  grid: '#EFE8DE',
  axis: '#A19389',
}

export const axisProps = {
  tick: { fill: chartColors.axis, fontSize: 11, fontWeight: 500 },
  tickLine: false,
  axisLine: false,
}

interface TooltipEntry {
  value?: number | string
  color?: string
  payload?: { label?: string }
}

interface SobaTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  suffix?: string
  labelFormatter?: (label: string) => string
}

export function SobaTooltip({ active, payload, label, suffix, labelFormatter }: SobaTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
      <p className="border-b border-line-soft bg-cream/70 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-brown">
        {labelFormatter ? labelFormatter(String(label)) : label}
      </p>
      <div className="space-y-1.5 px-3.5 py-2.5">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ background: (item.color as string) ?? chartColors.apricot }}
            />
            <span className="tabular font-semibold text-brown-dark">
              {item.value}
              {suffix ?? ''}
            </span>
            {item.payload?.label ? (
              <span className="text-ink-muted">· {item.payload.label}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Shared gradient defs so every chart pulls from the same palette. */
export function ChartDefs() {
  return (
    <defs>
      <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.apricot} stopOpacity={0.34} />
        <stop offset="55%" stopColor={chartColors.custard} stopOpacity={0.16} />
        <stop offset="100%" stopColor={chartColors.custard} stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="moodStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={chartColors.apricotLight} />
        <stop offset="50%" stopColor={chartColors.apricot} />
        <stop offset="100%" stopColor="#B8763A" />
      </linearGradient>
      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={chartColors.apricotLight} />
        <stop offset="100%" stopColor={chartColors.apricot} />
      </linearGradient>
      <linearGradient id="barFillMuted" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#C9B29B" />
        <stop offset="100%" stopColor={chartColors.brownSoft} />
      </linearGradient>
    </defs>
  )
}

interface ChartCardProps {
  title: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  height?: number | 'auto'
}

export function ChartCard({
  title,
  description,
  action,
  footer,
  children,
  className,
  height = 280,
}: ChartCardProps) {
  return (
    <Card padding="lg" className={cn('flex flex-col', className)}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div style={{ height }} className="-ml-2 w-[calc(100%+0.5rem)]">
        {children}
      </div>
      {footer ? (
        <div className="mt-6">
          <span className="divider-fade mb-4 block" aria-hidden="true" />
          {footer}
        </div>
      ) : null}
    </Card>
  )
}
