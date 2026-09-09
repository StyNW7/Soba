import { useMemo, useState } from 'react'
import { Clock, Play, Search, Wind } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Controls'
import { GroundingPlayer } from '../../components/voice/GroundingPlayer'
import { toolkitActivities, toolkitCategories } from '../../data/mockToolkit'
import type { ToolkitActivity } from '../../types'

export default function Toolkit() {
  const [category, setCategory] = useState<string>('All')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<ToolkitActivity | null>(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return toolkitActivities.filter((activity) => {
      const matchesCategory = category === 'All' || activity.category === category
      const matchesQuery =
        !normalized ||
        activity.title.toLowerCase().includes(normalized) ||
        activity.description.toLowerCase().includes(normalized)
      return matchesCategory && matchesQuery
    })
  }, [category, query])

  return (
    <>
      <PageHeader
        title="Wellbeing Toolkit"
        description="Short practices for the moments in between. Nothing here is tracked, scored, or shared."
      />

      <Card padding="md" className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-xs">
            <Input
              placeholder="Search activities"
              icon={<Search className="h-4 w-4" />}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search activities"
            />
          </div>
          <Tabs
            tabs={toolkitCategories.map((item) => ({ value: item, label: item }))}
            value={category}
            onChange={setCategory}
            size="sm"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wind}
          title="No activities match that search"
          description="Try a different word, or clear the filter to see the whole toolkit."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery('')
                setCategory('All')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((activity) => (
            <Card key={activity.id} padding="lg" interactive className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown">
                  <Wind className="h-5 w-5" aria-hidden="true" />
                </span>
                <Badge tone="cream">{activity.category}</Badge>
              </div>

              <h2 className="mt-5 text-lg font-semibold tracking-tight text-brown-dark">
                {activity.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">
                {activity.description}
              </p>

              <p className="mt-4 text-xs text-ink-muted">
                {activity.steps.length} steps · guided one at a time
              </p>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {activity.durationMinutes} min
                </span>
                <Button size="sm" onClick={() => setActive(activity)}>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  Start
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GroundingPlayer open={Boolean(active)} activity={active} onClose={() => setActive(null)} />
    </>
  )
}
