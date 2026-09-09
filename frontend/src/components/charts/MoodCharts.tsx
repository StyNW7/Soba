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
import { axisProps, chartColors, SobaTooltip } from './chartTheme'

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
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.apricot} stopOpacity={0.32} />
            <stop offset="100%" stopColor={chartColors.custard} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval={interval} dy={8} />
        <YAxis {...axisProps} domain={domain} width={44} />
        <Tooltip content={<SobaTooltip />} cursor={{ stroke: chartColors.brownSoft, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={chartColors.apricot}
          strokeWidth={2.5}
          fill="url(#moodFill)"
          dot={{ r: 3, fill: '#FFFFFF', stroke: chartColors.apricot, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: chartColors.apricot, stroke: '#FFFFFF', strokeWidth: 2 }}
          animationDuration={900}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function MoodLineChart({ data, xKey = 'date' }: { data: MoodPoint[]; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} dy={8} />
        <YAxis {...axisProps} domain={[40, 90]} width={44} />
        <Tooltip content={<SobaTooltip />} cursor={{ stroke: chartColors.brownSoft, strokeDasharray: '4 4' }} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={chartColors.brown}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: '#FFFFFF', stroke: chartColors.brown, strokeWidth: 2 }}
          activeDot={{ r: 5.5 }}
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
}: {
  data: Record<string, string | number>[]
  xKey?: string
  dataKey?: string
  domain?: [number, number]
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} dy={8} />
        <YAxis {...axisProps} domain={domain ?? [0, 'auto']} width={44} allowDecimals={false} />
        <Tooltip content={<SobaTooltip />} cursor={{ fill: 'rgba(227,222,164,0.28)' }} />
        <Bar dataKey={dataKey} radius={[10, 10, 4, 4]} animationDuration={900}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={Number(entry[dataKey]) >= 68 ? chartColors.apricot : chartColors.brownSoft}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MoodDonutChart({
  data,
}: {
  data: { name: string; value: number; color: string }[]
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return (
    <div className="flex h-full flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={2}
              stroke="#FFFFFF"
              strokeWidth={2}
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
          <span className="text-2xl font-semibold text-brown-dark">{total}</span>
          <span className="text-xs text-ink-muted">check-ins</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              <span className="truncate text-ink-secondary">{entry.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-brown-dark">
              {Math.round((entry.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
