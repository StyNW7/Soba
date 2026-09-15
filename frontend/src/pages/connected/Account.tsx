import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type {
  ProfileUpdate,
  DataJob,
  SafetyPlan,
} from '../../api/schema'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Screen, Panel, Field, Feedback, RemoteState } from './shared'
import { inputClass, useRemote, useAction, words } from './state'
import { LinksPanel } from './Connections'

export function SettingsPage() {
  const { profile, saveProfile } = useAuth()
  if (!profile) return null
  return (
    <Screen title="Account settings">
      <ProfileForm
        key={profile.version}
        value={{
          display_name: profile.display_name,
          roles: profile.roles,
          age_band: profile.age_band,
          locale: 'en-US',
          timezone: profile.timezone,
          shared_phone: profile.shared_phone,
          version: profile.version,
        }}
        save={saveProfile}
      />
    </Screen>
  )
}
function ProfileForm({
  value,
  save,
}: {
  value: ProfileUpdate
  save: (v: ProfileUpdate) => Promise<void>
}) {
  const [form, setForm] = useState(value)
  const action = useAction()
  return (
    <Panel>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(() => save(form))
        }}
      >
        <Field label="Display name">
          <input
            className={inputClass}
            required
            maxLength={80}
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          />
        </Field>
        <Field label="Shared phone (optional)">
          <input
            className={inputClass}
            type="tel"
            placeholder="+62…"
            value={form.shared_phone ?? ''}
            onChange={(e) =>
              setForm({ ...form, shared_phone: e.target.value || null })
            }
          />
        </Field>
        <p className="text-sm text-ink-secondary">
          This number can be included in authorized reach-out information.
        </p>
        <Field label="Timezone">
          <input
            className={inputClass}
            required
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </Field>
        <Button type="submit" loading={action.busy}>
          Save account
        </Button>
        <Feedback {...action} />
      </form>
    </Panel>
  )
}
export function PrivacyPage() {
  const { startLogin } = useAuth()
  const action = useAction()
  const [job, setJob] = useState<DataJob | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [scope, setScope] = useState<'history' | 'account'>('history')
  const [pollError, setPollError] = useState('')
  useEffect(() => {
    if (!job || ['ready', 'complete', 'failed', 'expired'].includes(job.state))
      return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api<DataJob>(
        job.receipt
          ? `/v1/deletion-status/${job.id}`
          : `/v1/data-jobs/${job.id}`,
        { receipt: job.receipt ?? undefined, signal: controller.signal },
      )
        .then((next) => {
          if (!controller.signal.aborted) {
            setPollError('')
            setJob({ ...next, receipt: job.receipt ?? next.receipt })
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setPollError(e.message)
        })
    }, 2000)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [job])
  return (
    <Screen
      title="Privacy and data"
      description="Your saved data and sharing permissions are managed in your SOBA account."
    >
      <LinksPanel />
      <Panel>
        <h2 className="text-xl font-semibold">Export your data</h2>
        <p>Export and deletion require a recent sign-in.</p>
        <Button
          type="button"
          variant="secondary"
          disabled={action.busy}
          onClick={() => void action.run(startLogin, '')}
        >
          Sign in again
        </Button>
        <Feedback error={pollError} />
        {pollError && (
          <Button type="button" onClick={() => setJob(job ? { ...job } : null)}>
            Retry job status
          </Button>
        )}
        <Button
          type="button"
          disabled={
            action.busy ||
            (!!job &&
              !['ready', 'complete', 'failed', 'expired'].includes(job.state))
          }
          onClick={() =>
            void action.run(
              async () =>
                setJob(
                  await api<DataJob>('/v1/exports', {
                    method: 'POST',
                    body: { format: 'json' },
                  }),
                ),
              'Export requested.',
            )
          }
        >
          Request JSON export
        </Button>
        {job && (
          <div role="status">
            <p>
              {words(job.kind)}: {words(job.state)}
            </p>
            {job.state === 'ready' && job.kind === 'export' && (
              <a
                className="underline"
                href={`/v1/data-jobs/${job.id}/download`}
                download
              >
                Download export
              </a>
            )}
            {job.receipt && (
              <p className="break-all text-sm">
                Keep this deletion receipt privately until the job completes:{' '}
                {job.receipt}
              </p>
            )}
          </div>
        )}
      </Panel>
      <Panel>
        <h2 className="text-xl font-semibold">Delete data</h2>
        <p>This cannot be undone. Type delete to confirm your choice.</p>
        <Field label="What to delete">
          <select
            className={inputClass}
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="history">Saved history</option>
            <option value="account">Entire account</option>
          </select>
        </Field>
        <Field label="Confirmation">
          <input
            className={inputClass}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button
          type="button"
          disabled={action.busy || confirmation !== 'delete'}
          onClick={() =>
            void action.run(async () => {
              const result = await api<DataJob>('/v1/deletions', {
                method: 'POST',
                body: { scope, confirmation: 'delete' },
              })
              setJob(result)
              setConfirmation('')
            }, 'Deletion requested.')
          }
        >
          Delete {scope}
        </Button>
      </Panel>
    </Screen>
  )
}
export function SafetyPlanPanel() {
  const remote = useRemote<SafetyPlan>('/v1/safety-plan')
  return (
    <Panel>
      <h2 className="text-xl font-semibold">My safety plan</h2>
      <RemoteState remote={remote} />
      {remote.value && (
        <PlanForm
          key={remote.value.version}
          plan={remote.value}
          reload={remote.reload}
        />
      )}
    </Panel>
  )
}
function PlanForm({ plan, reload }: { plan: SafetyPlan; reload: () => void }) {
  const [text, setText] = useState(plan.steps.join('\n'))
  const action = useAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run(async () => {
          await api('/v1/safety-plan', {
            method: 'PUT',
            body: {
              version: plan.version,
              steps: text
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            },
          })
          reload()
        })
      }}
    >
      <Field label="Steps (one per line, up to 10)">
        <textarea
          className={inputClass}
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <Button type="submit" loading={action.busy}>
        Save plan
      </Button>
      <Feedback {...action} />
    </form>
  )
}
