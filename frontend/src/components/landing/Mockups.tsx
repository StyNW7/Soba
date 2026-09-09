import { BatteryMedium, Mic, ShieldCheck, Wifi } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Waveform } from '../voice/VoiceOrb'

/**
 * Abstract representation of the Soba Companion hardware. Warm shapes rather
 * than a literal product photo, so nothing here overstates what exists.
 */
export function CompanionMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex aspect-square w-full max-w-[320px] items-center justify-center rounded-[42%_42%_46%_46%/48%_48%_40%_40%] bg-gradient-to-br from-[#F6EBDA] via-[#EEDFC7] to-[#DFC9A8] shadow-[0_30px_70px_rgba(82,58,40,0.16)]',
        className,
      )}
      role="img"
      aria-label="Illustration of the Soba Companion device"
    >
      <span className="absolute inset-3 rounded-[42%_42%_46%_46%/48%_48%_40%_40%] border border-white/50" />
      <span className="absolute left-[16%] top-[26%] h-14 w-14 rounded-full bg-white/35 blur-xl" />
      <div className="relative flex h-[46%] w-[46%] items-center justify-center rounded-full bg-gradient-to-br from-[#E8B478] via-[#D4954D] to-[#B8763A] shadow-[inset_0_2px_10px_rgba(255,255,255,0.4),0_14px_34px_rgba(184,118,58,0.32)]">
        <span className="h-8 w-full px-3">
          <Waveform state="speaking" bars={5} />
        </span>
      </div>
      <span className="absolute bottom-[13%] h-1.5 w-16 rounded-full bg-brown/15" />
    </div>
  )
}

/** Phone frame showing a compact Soba conversation surface. */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative w-[236px] shrink-0 rounded-[38px] border-[6px] border-brown-dark/90 bg-brown-dark p-1 shadow-[0_28px_60px_rgba(82,58,40,0.28)]',
        className,
      )}
      role="img"
      aria-label="Illustration of the Soba app on a phone"
    >
      <div className="relative overflow-hidden rounded-[32px] bg-background">
        <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[10px] font-semibold text-ink-muted">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            <BatteryMedium className="h-3 w-3" />
          </span>
        </div>
        <div className="px-4 pb-5">
          <p className="text-[11px] font-medium text-ink-muted">Talk to Soba</p>
          <div className="mt-3 flex justify-center">
            <div className="relative flex h-[92px] w-[92px] items-center justify-center rounded-full bg-gradient-to-br from-[#F0DCC0] to-[#D4954D] shadow-[0_10px_26px_rgba(212,149,77,0.35)]">
              <span className="h-6 w-full px-4">
                <Waveform state="listening" bars={5} />
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold text-brown">Listening</p>

          <div className="mt-4 space-y-2">
            <div className="ml-6 rounded-2xl rounded-tr-md bg-brown px-3 py-2 text-[10px] leading-relaxed text-cream">
              I have been feeling really overwhelmed today.
            </div>
            <div className="mr-4 rounded-2xl rounded-tl-md bg-cream px-3 py-2 text-[10px] leading-relaxed text-brown-dark">
              That sounds like a lot to carry. Would you like to talk about it, or slow things down first?
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
            <ShieldCheck className="h-3 w-3 shrink-0 text-sage" />
            <span className="text-[9px] leading-tight text-ink-secondary">
              Nothing is saved unless you choose to keep it.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Small floating status card used to dress the hero composition. */
export function StatusChip({
  icon: Icon = Mic,
  title,
  subtitle,
  className,
}: {
  icon?: typeof Mic
  title: string
  subtitle: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-soft backdrop-blur',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream text-brown">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brown-dark">{title}</p>
        <p className="text-[11px] text-ink-muted">{subtitle}</p>
      </div>
    </div>
  )
}
