import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Card } from '../ui/Card'

export const chartColors = {
  apricot: '#D4954D',
  brown: '#775533',
  custard: '#E3DEA4',
  brownSoft: '#A98970',
  terracotta: '#B5654F',
  sage: '#7C9070',
  grid: '#EDE6DA',
  axis: '#A19389',
}

export const axisProps = {
  tick: { fill: chartColors.axis, fontSize: 12, fontWeight: 500 },
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
    <div className="rounded-2xl border border-line bg-cream px-3.5 py-2.5 shadow-soft">
      <p className="text-xs font-semibold text-brown-dark">
        {labelFormatter ? labelFormatter(String(label)) : label}
      </p>
      <div className="mt-1.5 space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-ink-secondary">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: (item.color as string) ?? chartColors.apricot }}
            />
            <span className="font-medium text-brown-dark">
              {item.value}
              {suffix ?? ''}
            </span>
            {item.payload?.label ? <span className="text-ink-muted">· {item.payload.label}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

interface ChartCardProps {
  title: string
  description?: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  height?: number
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
          <h2 className="text-lg font-semibold tracking-tight text-brown-dark">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
      {footer ? <div className="mt-5 border-t border-line pt-4">{footer}</div> : null}
    </Card>
  )
}
