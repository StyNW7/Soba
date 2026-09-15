import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { Device, Claim } from '../../api/schema'
import { Button } from '../../components/ui/Button'
import { Screen, Panel, Field, Feedback, RemoteState } from './shared'
import { inputClass, useRemote, useAction, date } from './state'

export function DevicesPage() {
  const remote = useRemote<Device[]>('/v1/devices', true)
  const action = useAction()
  const [deviceId, setDeviceId] = useState('')
  const [claim, setClaim] = useState<Claim | null>(null)
  const [pollError, setPollError] = useState('')
  const { reload } = remote
  useEffect(() => {
    if (!claim || claim.status !== 'pending') return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api<Claim>(`/v1/device-claims/${claim.id}`, { signal: controller.signal })
        .then((next) => {
          if (!controller.signal.aborted) {
            setPollError('')
            setClaim(next)
            if (next.status === 'confirmed') reload()
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setPollError(e.message)
        })
    }, 3000)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [claim, reload])
  return (
    <Screen
      title="My SOBA"
      description="Device status comes from its latest server report."
    >
      <RemoteState remote={remote} empty={!remote.value?.length} />
      {remote.value?.map((d) => (
        <DeviceCard
          key={`${d.id}:${d.version}`}
          device={d}
          reload={remote.reload}
        />
      ))}
      <Panel>
        <h2 className="text-xl font-semibold">Pair a device</h2>
        <p>
          Enter the registered device ID from its QR label. Complete secure
          local provisioning on the physical device. Wi-Fi passwords and factory
          keys must not be entered on this page.
        </p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void action.run(
              async () =>
                setClaim(
                  await api<Claim>('/v1/device-claims', {
                    method: 'POST',
                    body: { device_id: deviceId },
                  }),
                ),
              'Claim created. The device must confirm it.',
            )
          }}
        >
          <Field label="Device ID">
            <input
              className={inputClass}
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={action.busy}>
            Start pairing
          </Button>
        </form>
        <Feedback {...action} />
        <Feedback error={pollError} />
        {claim && (
          <div className="space-y-2">
            <p>
              Pairing: {claim.status} · expires {date(claim.expires_at)}
            </p>
            {claim.status === 'pending' && (
              <>
                <p>
                  Pass these values to the device’s secure soba-claim
                  provisioning step.
                </p>
                <Field label="Claim ID">
                  <input className={inputClass} readOnly value={claim.id} />
                </Field>
                <Field label="Challenge">
                  <textarea
                    className={inputClass}
                    readOnly
                    value={claim.challenge ?? ''}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void action.run(
                      async () =>
                        setClaim(
                          await api<Claim>(`/v1/device-claims/${claim.id}`),
                        ),
                      '',
                    )
                  }
                >
                  Check pairing
                </Button>
              </>
            )}
          </div>
        )}
      </Panel>
    </Screen>
  )
}
function DeviceCard({
  device,
  reload,
}: {
  device: Device
  reload: () => void
}) {
  const action = useAction()
  const [name, setName] = useState(device.name)
  return (
    <Panel>
      <h2 className="text-xl font-semibold">{device.name}</h2>
      <p>
        {device.status} · Battery:{' '}
        {device.battery_percent === null
          ? 'Not reported'
          : `${device.battery_percent}%`}
      </p>
      <p>
        Last seen:{' '}
        {device.last_seen_at ? date(device.last_seen_at) : 'Not reported'}
      </p>
      <p>Firmware: {device.firmware_version || 'Not reported'}</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run(async () => {
            await api(`/v1/devices/${device.id}`, {
              method: 'PATCH',
              body: { name, version: device.version },
            })
            reload()
          })
        }}
      >
        <Field label="Device name">
          <input
            className={inputClass}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={action.busy}>
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={action.busy}
          onClick={() => {
            if (window.confirm('Unpair this device and revoke its credential?'))
              void action.run(async () => {
                await api(`/v1/devices/${device.id}`, { method: 'DELETE' })
                reload()
              }, 'Device unpaired.')
          }}
        >
          Unpair
        </Button>
        <Feedback {...action} />
      </form>
    </Panel>
  )
}
