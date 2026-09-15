import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { Trends } from '../../api/schema'
import { axisProps, chartColors } from '../../components/charts/chartTheme'
import { moods, words } from './state'
const colors = [
  chartColors.terracotta,
  chartColors.brownSoft,
  chartColors.custard,
  chartColors.apricot,
  chartColors.sage,
  chartColors.grid,
]
export function TrendChart({ value }: { value: Trends }) {
  const rows = value.buckets.map((b) => ({
    date: b.start_date,
    ...Object.fromEntries(
      moods.map((m) => [
        m,
        b.state === 'available'
          ? (b.counts.find((c) => c.label === m)?.count ?? 0)
          : null,
      ]),
    ),
  }))
  if (
    !value.buckets.some(
      (b) => b.state === 'available' && b.counts.some((c) => c.count > 0),
    )
  )
    return (
      <p className="py-12 text-center text-sm text-ink-secondary">
        Your pattern will appear when enough check-ins are available.
      </p>
    )
  return (
    <div className="space-y-4">
      <div
        className="h-64 w-full min-w-0"
        aria-label="Mood check-in counts by date"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid stroke={chartColors.grid} vertical={false} />
            <XAxis
              dataKey="date"
              {...axisProps}
              tickFormatter={(v) => String(v).slice(5)}
            />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip />
            {moods.map((m, i) => (
              <Bar
                key={m}
                dataKey={m}
                name={words(m)}
                stackId="mood"
                fill={colors[i]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-ink-secondary">
        {moods.map((m, i) => (
          <span className="inline-flex items-center gap-1.5 capitalize" key={m}>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: colors[i] }}
            />
            {words(m)}
          </span>
        ))}
      </div>
      <details className="text-sm text-ink-secondary">
        <summary className="cursor-pointer font-medium text-brown">
          View data table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="p-2">Period</th>
                {moods.map((m) => (
                  <th className="p-2 capitalize" key={m}>
                    {words(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.buckets.map((b) => (
                <tr key={b.start_date}>
                  <th className="p-2 font-normal">{b.start_date}</th>
                  {moods.map((m) => (
                    <td className="p-2" key={m}>
                      {b.state === 'available'
                        ? (b.counts.find((c) => c.label === m)?.count ?? 0)
                        : 'Not enough data'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
