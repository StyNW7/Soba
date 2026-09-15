import type { ReactNode } from 'react'
import { PageHeader, EmptyState } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { NotebookPen } from 'lucide-react'
import { Button } from '../../components/ui/Button'
export function Screen({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      {children}
    </div>
  )
}
export function Panel({ children }: { children: ReactNode }) {
  return (
    <Card padding="lg" className="space-y-4">
      {children}
    </Card>
  )
}
export function Feedback({
  error,
  message,
}: {
  error?: string
  message?: string
}) {
  return (
    <>
      {error && (
        <p role="alert" className="text-terracotta-dark">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sage-deep">
          {message}
        </p>
      )}
    </>
  )
}
export function RemoteState({
  remote,
  empty,
}: {
  remote: { error: string; loading: boolean; reload: () => void }
  empty?: boolean
}) {
  if (remote.loading) return <p role="status">Loading…</p>
  if (remote.error)
    return (
      <div>
        <Feedback error={remote.error} />
        <Button type="button" variant="ghost" onClick={remote.reload}>
          Retry
        </Button>
      </div>
    )
  return empty ? (
    <EmptyState
      icon={NotebookPen}
      bear="reading"
      title="Nothing here yet"
      description="Saved information will appear here when it is available."
    />
  ) : null
}
export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}
