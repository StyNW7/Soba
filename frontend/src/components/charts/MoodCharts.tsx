import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { axisProps, ChartDefs, chartColors, SobaTooltip } from './chartTheme'

interface MoodPoint {
  score: number
  label?: string
  [key: string]: string | number | undefined
}

export function MoodAreaChart({
  data,
  dataKey = 'score',
  xKey = 'date',
  domain = [40, 90] as [number, number],
  interval,
}: {
  data: MoodPoint[]
  dataKey?: string
  xKey?: string
  domain?: [number, number]
  interval?: number
}) {
  // Dots only help when the series is short enough to read individually.
  const showDots = data.length <= 14

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
        <ChartDefs />
        <CartesianGrid stroke={chartColors.grid} vertical={false} strokeDasharray="3 6" />
        <XAxis dataKey={xKey} {...axisProps} interval={interval} dy={10} minTickGap={12} />
        <YAxis {...axisProps} domain={domain} width={42} dx={-4} />
        <Tooltip
          content={<SobaTooltip />}
          cursor={{ stroke: chartColors.brownSoft, strokeDasharray: '4 4', strokeOpacity: 0.6 }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="url(#moodStroke)"
          strokeWidth={2.75}
          fill="url(#moodFill)"
          dot={showDots ? { r: 3, fill: '#FFFFFF', stroke: chartColors.apricot, strokeWidth: 2 } : false}
          activeDot={{ r: 5.5, fill: chartColors.apricot, stroke: '#FFFFFF', strokeWidth: 2.5 }}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MoodLineChart({ data, xKey = 'date' }: { data: MoodPoint[]; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
        <ChartDefs />
        <CartesianGrid stroke={chartColors.grid} vertical={false} strokeDasharray="3 6" />
        <XAxis dataKey={xKey} {...axisProps} dy={10} />
        <YAxis {...axisProps} domain={[40, 90]} width={42} dx={-4} />
        <Tooltip
          content={<SobaTooltip />}
          cursor={{ stroke: chartColors.brownSoft, strokeDasharray: '4 4', strokeOpacity: 0.6 }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={chartColors.brown}
          strokeWidth={2.75}
          dot={{ r: 3.5, fill: '#FFFFFF', stroke: chartColors.brown, strokeWidth: 2 }}
          activeDot={{ r: 5.5, strokeWidth: 2.5, stroke: '#FFFFFF' }}
          animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function MoodBarChart({
  data,
  xKey = 'day',
  dataKey = 'score',
  domain,
  threshold = 68,
}: {
  data: Record<string, string | number>[]
  xKey?: string
  dataKey?: string
  domain?: [number, number]
  threshold?: number
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }} barCategoryGap="30%">
        <ChartDefs />
        <CartesianGrid stroke={chartColors.grid} vertical={false} strokeDasharray="3 6" />
        <XAxis dataKey={xKey} {...axisProps} dy={10} />
        <YAxis {...axisProps} domain={domain ?? [0, 'auto']} width={42} dx={-4} allowDecimals={false} />
        <Tooltip content={<SobaTooltip />} cursor={{ fill: 'rgba(227,222,164,0.22)', radius: 12 }} />
        <Bar dataKey={dataKey} radius={[12, 12, 5, 5]} animationDuration={900} maxBarSize={56}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={Number(entry[dataKey]) >= threshold ? 'url(#barFill)' : 'url(#barFillMuted)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MoodDonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="flex h-full flex-col items-center gap-7 sm:flex-row">
      <div className="relative h-[196px] w-[196px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={94}
              paddingAngle={3}
              cornerRadius={6}
              stroke="#FFFFFF"
              strokeWidth={2.5}
              animationDuration={900}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SobaTooltip suffix=" check-ins" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-[28px] font-semibold leading-none text-brown-dark">{total}</span>
          <span className="mt-1 text-[11px] uppercase tracking-wide text-ink-muted">check-ins</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {data.map((entry) => (
          <li
            key={entry.name}
            className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-cream/60"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span className="truncate text-ink-secondary">{entry.name}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-brown-dark">
              {Math.round((entry.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Compact inline trend, for card corners where a full chart would be too much. */
export function Sparkline({
  data,
  dataKey = 'score',
  height = 40,
}: {
  data: MoodPoint[]
  dataKey?: string
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <ChartDefs />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={chartColors.apricot}
            strokeWidth={2}
            fill="url(#moodFill)"
            dot={false}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
