import { useMemo, useState } from 'react'
import { CalendarDays, Info, Lightbulb, TrendingUp } from 'lucide-react'
import { PageHeader, PrivacyNote, StatCard } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Tabs } from '../../components/ui/Controls'
import { MoodIcon } from '../../components/ui/Brand'
import { ChartCard } from '../../components/charts/chartTheme'
import { MoodAreaChart, MoodBarChart, MoodDonutChart } from '../../components/charts/MoodCharts'
import { useAppData } from '../../context/AppDataContext'
import {
  checkinFrequency,
  moodDistribution,
  moodInsights,
  ninetyDayMood,
  thirtyDayMood,
  weekdayPattern,
  weeklyMood,
} from '../../data/mockMood'

type Range = '7' | '30' | '90'

export default function MoodPatterns() {
  const { moods } = useAppData()
  const [range, setRange] = useState<Range>('30')

  const trendData = useMemo(() => {
    if (range === '7') return weeklyMood
    if (range === '30') return thirtyDayMood
    return ninetyDayMood
  }, [range])

  const average = Math.round(
    trendData.reduce((sum, point) => sum + point.score, 0) / Math.max(trendData.length, 1),
  )

  return (
    <>
      <PageHeader
        eyebrow="Patterns, not diagnoses"
        title="Mood & Patterns"
        description="A picture of how things have been, built from your own check-ins and conversations."
        action={
          <Tabs
            tabs={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
            value={range}
            onChange={setRange}
          />
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Average wellbeing" value={String(average)} hint="Your own scale, not a clinical score" />
        <StatCard icon={CalendarDays} label="Check-ins recorded" value={String(moods.length)} hint="Across this period" />
        <StatCard icon={Info} label="Most frequent" value="Okay" hint="11 of 30 check-ins" />
        <StatCard icon={Lightbulb} label="Steadiest day" value="Saturday" hint="Highest average this month" tone="cream" />
      </div>

      <div className="mb-5">
        <ChartCard
          title="Mood overview"
          description={`Wellbeing direction across the last ${range} days.`}
          height={320}
          footer={<PrivacyNote>Only you see this view. Guardians receive direction over time, never entries.</PrivacyNote>}
        >
          <MoodAreaChart
            data={trendData}
            interval={range === '7' ? 0 : Math.ceil(trendData.length / 8)}
          />
        </ChartCard>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <ChartCard
          title="Mood distribution"
          description="How your check-ins have been spread across labels."
          height={220}
        >
          <MoodDonutChart data={moodDistribution} />
        </ChartCard>

        <ChartCard
          title="Weekly pattern"
          description="Average wellbeing by day of the week."
          height={220}
          footer={
            <p className="text-sm leading-relaxed text-ink-secondary">
              You tend to report more stress during weekday evenings.
            </p>
          }
        >
          <MoodBarChart data={weekdayPattern} domain={[40, 90]} />
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <ChartCard
          title="Check-in frequency"
          description="How often you have checked in each week."
          height={200}
        >
          <MoodBarChart data={checkinFrequency} xKey="week" dataKey="count" domain={[0, 7]} />
        </ChartCard>

        <Card padding="lg">
          <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">Reflection insight</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Observations drawn from your own words. Soba does not interpret these as a condition.
          </p>
          <ul className="mt-5 space-y-3">
            {moodInsights.map((insight) => (
              <li
                key={insight}
                className="flex items-start gap-3 rounded-2xl bg-cream/70 px-4 py-3.5 text-sm leading-relaxed text-brown-dark"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-apricot" aria-hidden="true" />
                {insight}
              </li>
            ))}
          </ul>

          <h3 className="mt-7 text-sm font-semibold text-brown-dark">Recent check-ins</h3>
          <ul className="mt-3 divide-y divide-line">
            {moods.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <MoodIcon mood={entry.label} className="h-5 w-5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brown-dark">{entry.label}</p>
                    <p className="text-xs text-ink-muted">
                      {entry.date} · {entry.source === 'check-in' ? 'Check-in' : 'From a conversation'}
                    </p>
                  </div>
                </div>
                <Badge tone="cream">{entry.score}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Accessible table alongside the charts */}
      <Card padding="lg" className="mt-5">
        <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">Weekly data</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          The same information as the chart above, in a readable table.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Wellbeing score by day for the current week</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Day
                </th>
                <th scope="col" className="pb-3 pr-4 font-semibold">
                  Score
                </th>
                <th scope="col" className="pb-3 font-semibold">
                  Label
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {weeklyMood.map((point) => (
                <tr key={point.date}>
                  <th scope="row" className="py-3 pr-4 text-left font-medium text-brown-dark">
                    {point.date}
                  </th>
                  <td className="py-3 pr-4 text-ink-secondary">{point.score}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-2 text-ink-secondary">
                      <MoodIcon mood={point.label} />
                      {point.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
