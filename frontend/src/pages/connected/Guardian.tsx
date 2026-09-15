import { CalendarCheck, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { StatCard, PrivacyNote } from '../../components/ui/Feedback'
import { TrendChart } from './TrendChart'
import { completeWeeks } from '../../api/dates'
import { useState } from 'react'
import type { Subject, Pulse, Trends, ConnectionStatus } from '../../api/schema'
import { Screen, Panel, Field, RemoteState } from './shared'
import { inputClass, useRemote, words } from './state'
import { LinksPanel } from './Connections'

export function GuardianPage() {
  const subjects = useRemote<Subject[]>('/v1/guardian/subjects', true)
  const [id, setId] = useState('')
  const selected =
    subjects.value?.find((s) => s.id === id) ?? subjects.value?.[0]
  return (
    <Screen
      title="Supporting someone"
      description="You see only the information this person has given you permission to view."
    >
      <Panel>
        <RemoteState remote={subjects} empty={!subjects.value?.length} />
        {subjects.value?.length ? (
          <Field label="Person you support">
            <select
              className={inputClass}
              value={selected?.id ?? ''}
              onChange={(e) => setId(e.target.value)}
            >
              {subjects.value.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </Panel>
      {selected && <SubjectView key={selected.id} subject={selected} />}
      <LinksPanel />
    </Screen>
  )
}
function SubjectView({ subject }: { subject: Subject }) {
  const base = `/v1/guardian/subjects/${subject.id}`
  const pulse = useRemote<Pulse>(
    subject.scopes.includes('wellbeing_pulse')
      ? `${base}/pulse?${completeWeeks(2)}`
      : null,
  )
  const trends = useRemote<Trends>(
    subject.scopes.includes('mood_trend')
      ? `${base}/trends?${completeWeeks(4)}`
      : null,
  )
  const connection = useRemote<ConnectionStatus>(
    subject.scopes.some((s) =>
      ['trusted_contacts', 'safety_plan', 'referral_status'].includes(s),
    )
      ? `${base}/connection-status`
      : null,
  )
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="Shared check-ins"
          value={pulse.value ? String(pulse.value.check_in_count) : '—'}
          hint="Two completed weeks"
        />
        <StatCard
          icon={TrendingUp}
          label="Overall trend"
          value={pulse.value ? words(pulse.value.trend) : 'Not shared'}
          hint="Only the server's shared summary"
        />
        <StatCard
          icon={ShieldCheck}
          label="Sharing permissions"
          value={String(subject.scopes.length)}
          hint="Chosen by the person you support"
        />
        <StatCard
          icon={Users}
          label="Shared contacts"
          value={
            connection.value ? String(connection.value.contacts.length) : '—'
          }
          hint="Only contacts you may view"
        />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1.6fr]">
        <Panel>
          <h2 className="text-xl font-semibold">
            {subject.display_name}’s wellbeing
          </h2>
          {subject.scopes.includes('wellbeing_pulse') ? (
            <>
              <RemoteState remote={pulse} />
              {pulse.value && (
                <>
                  <p>
                    {pulse.value.check_in_count} check-ins ·{' '}
                    {words(pulse.value.trend)}
                  </p>
                  <p>
                    {pulse.value.period_start} – {pulse.value.period_end}
                  </p>
                </>
              )}
            </>
          ) : (
            <p>Wellbeing pulse has not been shared.</p>
          )}
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Shared mood trends</h2>
          {subject.scopes.includes('mood_trend') ? (
            <>
              <RemoteState remote={trends} />
              {trends.value && <TrendChart value={trends.value} />}
            </>
          ) : (
            <p>Mood trends have not been shared.</p>
          )}
        </Panel>
      </div>
      <PrivacyNote>
        Private conversations remain private. Only approved summaries are
        shared.
      </PrivacyNote>
      <Panel>
        <h2 className="text-xl font-semibold">Safety connection</h2>
        <RemoteState remote={connection} />
        {connection.value ? (
          <>
            <p>
              Shared: {connection.value.visible_scopes.map(words).join(', ')}
            </p>
            {connection.value.contacts.map((c, i) => (
              <p key={i}>
                {c.display_name} · {c.relationship}
              </p>
            ))}
            {connection.value.plan?.steps.map((s, i) => (
              <p key={i}>
                {i + 1}. {s}
              </p>
            ))}
            {connection.value.referrals.map((r, i) => (
              <p key={i}>
                {r.resource_name} · {words(r.state)}
              </p>
            ))}
          </>
        ) : (
          <p>No connection information is available.</p>
        )}
      </Panel>
    </>
  )
}
