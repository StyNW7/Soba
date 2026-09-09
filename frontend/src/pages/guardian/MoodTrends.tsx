import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { PageHeader, PrivacyNote } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Tabs } from '../../components/ui/Controls'
import { ChartCard } from '../../components/charts/chartTheme'
import { MoodAreaChart, MoodLineChart } from '../../components/charts/MoodCharts'
import { useAuth } from '../../context/AuthContext'
import { guardianMonthlyTrend, guardianTrend } from '../../data/mockGuardian'

const notShared = [
  'Conversation transcripts',
  'Journal entries and reflections',
  'Topics discussed with Soba',
  'Saved memories',
]

export default function MoodTrends() {
  const { user } = useAuth()
  const subject = user?.subjectName ?? 'Nara'
  const [range, setRange] = useState<'week' | 'month'>('week')

  return (
    <>
      <PageHeader
        title="Mood Trends"
        description={`Aggregated direction for ${subject}. Individual entries and topics are not included.`}
        action={
          <Tabs
            tabs={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
            ]}
            value={range}
            onChange={setRange}
          />
        }
      />

      <div className="mb-5">
        <ChartCard
          title={range === 'week' ? 'Weekly direction' : 'Monthly direction'}
          description="Higher is steadier. This is a relative view, not a clinical measure."
          height={320}
          footer={<PrivacyNote>Only high-level wellbeing patterns are shared.</PrivacyNote>}
        >
          {range === 'week' ? (
            <MoodAreaChart data={guardianTrend} />
          ) : (
            <MoodLineChart data={guardianMonthlyTrend} xKey="week" />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padding="lg">
          <h2 className="text-lg font-semibold tracking-tight text-brown-dark">Weekly data</h2>
          <p className="mt-1 text-sm text-ink-secondary">The same information in a readable table.</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[340px] text-sm">
              <caption className="sr-only">Aggregated wellbeing direction by day</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="pb-3 pr-4 font-semibold">Day</th>
                  <th scope="col" className="pb-3 font-semibold">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {guardianTrend.map((point) => (
                  <tr key={point.date}>
                    <th scope="row" className="py-3 pr-4 text-left font-medium text-brown-dark">
                      {point.date}
                    </th>
                    <td className="py-3 text-ink-secondary">
                      {point.score >= 72 ? 'Steadier' : point.score >= 62 ? 'Around usual' : 'More difficult'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-lg font-semibold tracking-tight text-brown-dark">What is not shared</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            These stay with {subject} and are not available on any guardian screen.
          </p>
          <ul className="mt-5 space-y-2.5">
            {notShared.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-line bg-muted/50 px-4 py-3 text-sm text-ink-secondary"
              >
                <LockKeyhole className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-ink-secondary">
            This boundary is what makes honest conversation possible. Share the risk, not the private
            story.
          </p>
        </Card>
      </div>
    </>
  )
}
