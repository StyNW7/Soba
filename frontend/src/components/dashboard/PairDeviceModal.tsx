import { useEffect, useState } from 'react'
import { Bluetooth, Check, Cpu, QrCode, TriangleAlert, Wifi } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'

type Stage = 'code' | 'connecting' | 'wifi' | 'claiming' | 'done'

interface PairDeviceModalProps {
  open: boolean
  onClose: () => void
  onPaired: (name: string) => void
}

const VALID_CODE = 'SOBA-4417'
const CLAIM_SECONDS = 300

const stageLabels: { key: Stage; label: string }[] = [
  { key: 'code', label: 'Device code' },
  { key: 'connecting', label: 'Connect' },
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'claiming', label: 'Claim' },
]

/**
 * Device provisioning (F1 step 4-5). The countdown mirrors the five-minute
 * claim window in the spec; each failure mode gets its own retry action rather
 * than a generic error.
 */
export function PairDeviceModal({ open, onClose, onPaired }: PairDeviceModalProps) {
  const [stage, setStage] = useState<Stage>('code')
  const [code, setCode] = useState('')
  const [ssid, setSsid] = useState('Rumah-2.4G')
  const [password, setPassword] = useState('')
  const [deviceName, setDeviceName] = useState('Soba Bedroom')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(CLAIM_SECONDS)

  useEffect(() => {
    if (!open) return
    setStage('code')
    setCode('')
    setPassword('')
    setError('')
    setRemaining(CLAIM_SECONDS)
  }, [open])

  useEffect(() => {
    if (!open || stage === 'done') return
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [open, stage])

  const expired = remaining === 0 && stage !== 'done'

  function submitCode() {
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setError('Enter the code printed underneath your companion.')
      return
    }
    if (normalized !== VALID_CODE) {
      setError(`That code was not recognised. For this demo, use ${VALID_CODE}.`)
      return
    }
    setError('')
    setStage('connecting')
    window.setTimeout(() => setStage('wifi'), 1400)
  }

  function submitWifi() {
    if (!ssid.trim()) {
      setError('Choose the network your companion should join.')
      return
    }
    setError('')
    setStage('claiming')
    window.setTimeout(() => setStage('done'), 1600)
  }

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pair your Soba Companion"
      description="Scan the QR code on the base, or enter the device code printed underneath."
      footer={
        stage === 'done' ? (
          <Button
            data-autofocus
            onClick={() => {
              onPaired(deviceName)
              onClose()
            }}
          >
            Finish setup
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {stage === 'code' ? (
              <Button onClick={submitCode} disabled={expired}>
                Continue
              </Button>
            ) : stage === 'wifi' ? (
              <Button onClick={submitWifi} disabled={expired}>
                Send Wi-Fi details
              </Button>
            ) : (
              <Button disabled loading>
                Working
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-5">
        {/* Stepper */}
        <ol className="flex items-center gap-2">
          {stageLabels.map((item, index) => {
            const currentIndex = stageLabels.findIndex((s) => s.key === stage)
            const done = stage === 'done' || index < currentIndex
            const active = item.key === stage
            return (
              <li key={item.key} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                    done
                      ? 'bg-sage text-white'
                      : active
                        ? 'bg-apricot text-white'
                        : 'bg-muted text-ink-muted',
                  )}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden text-xs font-medium sm:block',
                    active ? 'text-brown-dark' : 'text-ink-muted',
                  )}
                >
                  {item.label}
                </span>
                {index < stageLabels.length - 1 ? (
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                ) : null}
              </li>
            )
          })}
        </ol>

        {/* Countdown */}
        {stage !== 'done' ? (
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm',
              expired ? 'bg-terracotta-soft text-terracotta-dark' : 'bg-muted text-ink-secondary',
            )}
            role={expired ? 'alert' : undefined}
          >
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            {expired ? (
              <span className="flex flex-wrap items-center gap-2">
                This pairing window has closed.
                <button
                  type="button"
                  onClick={() => {
                    setRemaining(CLAIM_SECONDS)
                    setStage('code')
                    setError('')
                  }}
                  className="font-semibold underline underline-offset-4"
                >
                  Start again
                </button>
              </span>
            ) : (
              <span>
                Pairing window closes in{' '}
                <span className="font-semibold text-brown-dark">
                  {minutes}:{String(seconds).padStart(2, '0')}
                </span>
              </span>
            )}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm font-medium text-terracotta-dark">
            {error}
          </p>
        ) : null}

        {stage === 'code' ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-3xl bg-cream px-6 py-8 text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-dashed border-brown/25 bg-surface text-brown-soft">
                <QrCode className="h-10 w-10" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-medium text-brown-dark">Scan the code on the base</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Camera scanning is available in the mobile app. On the web, enter the code manually.
              </p>
            </div>

            <Input
              label="Device code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={VALID_CODE}
              hint={`Printed underneath your companion. For this demo, use ${VALID_CODE}.`}
              data-autofocus
              autoCapitalize="characters"
            />
          </div>
        ) : null}

        {stage === 'connecting' ? (
          <div className="flex flex-col items-center rounded-3xl bg-cream px-6 py-12 text-center">
            <Bluetooth className="h-8 w-8 animate-breathe text-apricot" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-brown-dark">Connecting to your companion</p>
            <p className="mt-1 text-xs text-ink-secondary">
              Keep the device within a metre or two while this completes.
            </p>
          </div>
        ) : null}

        {stage === 'wifi' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-sage-soft px-4 py-3">
              <Check className="h-4 w-4 shrink-0 text-sage" aria-hidden="true" />
              <p className="text-sm text-[#4A5C40]">Connected to the companion.</p>
            </div>
            <Input
              label="Wi-Fi network"
              value={ssid}
              onChange={(event) => setSsid(event.target.value)}
              icon={<Wifi className="h-4 w-4" />}
              data-autofocus
            />
            <Input
              label="Wi-Fi password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="Sent directly to the device over the local connection, never stored by Soba."
            />
          </div>
        ) : null}

        {stage === 'claiming' ? (
          <div className="flex flex-col items-center rounded-3xl bg-cream px-6 py-12 text-center">
            <Cpu className="h-8 w-8 animate-breathe text-apricot" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-brown-dark">Claiming the device</p>
            <p className="mt-1 text-xs text-ink-secondary">Linking it to your account.</p>
          </div>
        ) : null}

        {stage === 'done' ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center rounded-3xl bg-sage-soft px-6 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage text-white">
                <Check className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-semibold text-[#40522F]">Your companion is paired</p>
              <p className="mt-1 text-sm text-[#4A5C40]">
                Give it a name so you can tell devices apart later.
              </p>
            </div>
            <Input
              label="Device name"
              value={deviceName}
              onChange={(event) => setDeviceName(event.target.value)}
              data-autofocus
            />
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
