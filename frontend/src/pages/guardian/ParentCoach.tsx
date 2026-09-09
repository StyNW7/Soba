import { useState } from 'react'
import { BookOpenText, Check, Clock, X } from 'lucide-react'
import { PageHeader } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { coachModules } from '../../data/mockGuardian'
import type { CoachModule } from '../../types'

const doList = ['Listen', 'Stay calm', 'Validate feelings', 'Give space']
const avoidList = ['Interrogating', 'Minimizing', 'Comparing', 'Immediately giving solutions']

export default function ParentCoach() {
  const [active, setActive] = useState<CoachModule | null>(null)

  return (
    <>
      <PageHeader
        title="Parent Coach"
        description="Short, reviewed guidance for the conversations that matter. Nothing here uses private content."
      />

      {/* Featured */}
      <Card tone="brown" padding="lg" className="mb-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Badge tone="apricot">Featured</Badge>
            <h2 className="mt-4 heading-serif text-[28px] leading-tight text-cream sm:text-[34px]">
              Before you start the conversation
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-cream/75">
              The way a conversation opens shapes everything that follows. A few minutes of
              preparation usually matters more than finding the perfect words.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-cream/15 bg-cream/[0.06] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-custard">Do</p>
              <ul className="mt-3.5 space-y-2.5">
                {doList.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-cream">
                    <Check className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-cream/15 bg-cream/[0.06] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-custard">Avoid</p>
              <ul className="mt-3.5 space-y-2.5">
                {avoidList.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-cream">
                    <X className="h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {coachModules.map((module) => (
          <Card key={module.id} padding="lg" interactive className="flex h-full flex-col">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown">
              <BookOpenText className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-semibold tracking-tight text-brown-dark">{module.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{module.summary}</p>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4">
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {module.duration}
              </span>
              <Button size="sm" variant="secondary" onClick={() => setActive(module)}>
                Read
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title ?? ''}
        description={active?.duration}
        footer={
          <Button onClick={() => setActive(null)} data-autofocus>
            Done
          </Button>
        }
      >
        {active ? (
          <div className="space-y-4">
            {active.body.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
            <p className="rounded-2xl bg-muted px-4 py-3 text-xs leading-relaxed text-ink-secondary">
              This guidance is general and reviewed before publishing. It is not tailored to any
              private content and is not clinical advice.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
