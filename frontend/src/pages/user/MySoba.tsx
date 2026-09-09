import { useState } from 'react'
import {
  BatteryMedium,
  Bluetooth,
  Cpu,
  Link2Off,
  Mic,
  MicOff,
  Moon,
  Power,
  RefreshCw,
  Volume2,
  Wifi,
} from 'lucide-react'
import { EmptyState, PageHeader, PrivacyNote, StatCard } from '../../components/ui/Feedback'
import { Card, SectionCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/Field'
import { Progress, Toggle } from '../../components/ui/Controls'
import { Modal } from '../../components/ui/Modal'
import { CompanionMockup } from '../../components/landing/Mockups'
import { PairDeviceModal } from '../../components/dashboard/PairDeviceModal'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { deviceActivity } from '../../data/mockDevice'
import type { SobaDevice } from '../../types'

const listeningOptions = [
  { value: 'push-to-talk', label: 'Push to talk' },
  { value: 'wake-word', label: 'Wake word' },
  { value: 'always', label: 'Always listening' },
]

export default function MySoba() {
  const { device, updateDevice, pairDevice, unpairDevice } = useAppData()
  const { toast } = useToast()
  const [pairOpen, setPairOpen] = useState(false)
  const [unpairOpen, setUnpairOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [syncing, setSyncing] = useState(false)

  function handleSync() {
    if (!device) return
    setSyncing(true)
    window.setTimeout(() => {
      updateDevice({ lastSync: 'Just now' })
      setSyncing(false)
      toast('Device synced', { description: 'Approved memories and settings are up to date.' })
    }, 1200)
  }

  // Unpaired state — the app is fully usable without hardware (F1 step 4).
  if (!device) {
    return (
      <>
        <PageHeader
          title="My Soba"
          description="Pair a Soba Companion, or keep using the app on its own. The app works fully without hardware."
        />

        <EmptyState
          icon={Cpu}
          title="No companion paired"
          description="Pair your Soba Companion to see battery, connection, and voice settings here. Everything else in the app works without it."
          action={<Button onClick={() => setPairOpen(true)}>Pair a companion</Button>}
        />

        <PairDeviceModal
          open={pairOpen}
          onClose={() => setPairOpen(false)}
          onPaired={(name) => {
            pairDevice(name)
            toast('Companion paired', { description: `${name} is now linked to your account.` })
          }}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="My Soba"
        description="Your companion device, its settings, and exactly what it is doing right now."
        action={
          <div className="flex gap-2.5">
            <Button variant="secondary" size="lg" onClick={handleSync} loading={syncing}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Sync now
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card tone="cream" padding="lg" className="flex flex-col items-center justify-center text-center">
          <CompanionMockup className="max-w-[220px]" />
          <h2 className="mt-7 text-xl font-semibold text-brown-dark">{device.name}</h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge tone={device.status === 'connected' ? 'sage' : 'neutral'}>
              {device.status === 'connected'
                ? 'Connected'
                : device.status === 'syncing'
                  ? 'Syncing'
                  : 'Offline'}
            </Badge>
            <Badge tone={device.micEnabled ? 'apricot' : 'neutral'}>
              {device.micEnabled ? 'Microphone on' : 'Microphone off'}
            </Badge>
          </div>
          <p className="mt-4 text-sm text-ink-secondary">Last sync {device.lastSync}</p>

          <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setNameDraft(device.name)
                setRenameOpen(true)
              }}
            >
              Rename
            </Button>
            <Button variant="outline" fullWidth onClick={() => setUnpairOpen(true)}>
              <Link2Off className="h-4 w-4" aria-hidden="true" />
              Unpair
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={BatteryMedium} label="Battery" value={`${device.battery}%`} hint="Reported at last sync" />
          <StatCard icon={Wifi} label="Wi-Fi" value="Connected" hint={device.wifi} />
          <StatCard icon={Cpu} label="Firmware" value={device.firmware} hint={`Updated ${device.firmwareUpdatedAt}`} />
          <StatCard icon={Bluetooth} label="Pairing" value="Paired" hint="Provisioned on this account" />

          <Card padding="lg" className="sm:col-span-2">
            <Progress
              value={device.battery}
              label="Battery level"
              showValue
              tone={device.battery > 25 ? 'sage' : 'apricot'}
            />
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              Battery is reported when the device syncs, so this can lag behind by a few minutes.
            </p>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Sound & interaction"
          description="Volume and when the companion listens. Voice and personality live in Personalization."
          icon={<Volume2 className="h-[18px] w-[18px]" />}
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="volume" className="text-sm font-medium text-brown-dark">
                Volume
              </label>
              <div className="mt-2.5 flex items-center gap-3">
                <Volume2 className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <input
                  id="volume"
                  type="range"
                  min={0}
                  max={100}
                  value={device.volume}
                  onChange={(event) => updateDevice({ volume: Number(event.target.value) })}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#D4954D]"
                />
                <span className="w-10 shrink-0 text-right text-sm font-medium text-brown-dark">
                  {device.volume}
                </span>
              </div>
            </div>

            <Select
              label="Listening mode"
              options={listeningOptions}
              value={device.listeningMode}
              onChange={(event) =>
                updateDevice({ listeningMode: event.target.value as SobaDevice['listeningMode'] })
              }
              hint="Push to talk is the most private option and the default."
            />

            <div className="space-y-4 border-t border-line pt-5">
              <Toggle
                checked={device.hapticGuidance}
                onChange={(value) => updateDevice({ hapticGuidance: value })}
                label="Haptic guidance"
                description="A gentle pulse to pace breathing during grounding sessions."
              />
              <Toggle
                checked={device.nightMode}
                onChange={(value) => updateDevice({ nightMode: value })}
                label="Night mode"
                description="Dimmed light and a quieter voice between 21:00 and 07:00."
              />
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard
            title="Privacy controls"
            description="The microphone state is physical and always visible on the device."
            icon={<Mic className="h-[18px] w-[18px]" />}
          >
            <div className="space-y-5">
              <div
                className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${
                  device.micEnabled ? 'border-apricot/30 bg-apricot-soft/40' : 'border-line bg-muted'
                }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    device.micEnabled ? 'bg-apricot text-white' : 'bg-surface text-ink-muted'
                  }`}
                >
                  {device.micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </span>
                <div className="min-w-[150px] flex-1">
                  <p className="text-sm font-semibold text-brown-dark">
                    Microphone {device.micEnabled ? 'enabled' : 'disabled'}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                    {device.micEnabled
                      ? 'The device can capture audio when you start a session.'
                      : 'No audio can be captured until you enable it again.'}
                  </p>
                </div>
                <Button
                  variant={device.micEnabled ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => {
                    updateDevice({ micEnabled: !device.micEnabled })
                    toast(device.micEnabled ? 'Microphone disabled' : 'Microphone enabled', {
                      tone: device.micEnabled ? 'warning' : 'success',
                    })
                  }}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden="true" />
                  {device.micEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <PrivacyNote>
                Memory sync is explicit. The device does not upload anything until you review it in
                Memory &amp; Privacy.
              </PrivacyNote>
            </div>
          </SectionCard>

          <SectionCard title="Device activity" description="A plain record of what the device has done.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <caption className="sr-only">Recent device activity</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
                    <th scope="col" className="pb-3 pr-4 font-semibold">Event</th>
                    <th scope="col" className="pb-3 pr-4 font-semibold">Detail</th>
                    <th scope="col" className="pb-3 font-semibold">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {deviceActivity.map((item) => (
                    <tr key={item.id}>
                      <th scope="row" className="py-3 pr-4 text-left font-medium text-brown-dark">
                        {item.event}
                      </th>
                      <td className="py-3 pr-4 text-ink-secondary">{item.detail}</td>
                      <td className="py-3 text-ink-muted">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      <Card padding="lg" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Moon className="mt-0.5 h-5 w-5 shrink-0 text-brown-soft" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-brown-dark">Firmware {device.firmware}</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Last updated {device.firmwareUpdatedAt}. Your device is up to date.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => toast('Your device is already up to date', { tone: 'info' })}
          >
            Check for updates
          </Button>
        </div>
      </Card>

      {/* Rename */}
      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename this companion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!nameDraft.trim()}
              onClick={() => {
                updateDevice({ name: nameDraft.trim() })
                setRenameOpen(false)
                toast('Device renamed')
              }}
            >
              Save name
            </Button>
          </>
        }
      >
        <Input
          label="Device name"
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          data-autofocus
          maxLength={40}
        />
      </Modal>

      {/* Unpair — the dialog names the exact device */}
      <Modal
        open={unpairOpen}
        onClose={() => setUnpairOpen(false)}
        title={`Unpair ${device.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnpairOpen(false)}>
              Keep paired
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                unpairDevice()
                setUnpairOpen(false)
                toast('Companion unpaired', {
                  tone: 'warning',
                  description: 'The app keeps working. You can pair again at any time.',
                })
              }}
            >
              Unpair device
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-secondary">
          <span className="font-semibold text-brown-dark">{device.name}</span> will be removed from
          your account and will stop syncing. Your reflections, mood history, and memories stay
          exactly as they are.
        </p>
      </Modal>

      <PairDeviceModal
        open={pairOpen}
        onClose={() => setPairOpen(false)}
        onPaired={(name) => {
          pairDevice(name)
          toast('Companion paired')
        }}
      />
    </>
  )
}
