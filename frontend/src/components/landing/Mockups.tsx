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
        'relative flex aspect-square w-full max-w-[320px] items-center justify-center',
        'rounded-[42%_42%_46%_46%/48%_48%_40%_40%]',
        'bg-gradient-to-br from-[#F8F0E3] via-[#EEDFC7] to-[#DBC29C]',
        'shadow-[0_30px_70px_rgba(82,58,40,0.18),inset_0_-14px_36px_rgba(146,110,70,0.16),inset_0_10px_28px_rgba(255,255,255,0.6)]',
        className,
      )}
      role="img"
      aria-label="Illustration of the Soba Companion device"
    >
      {/* Inner contour and a soft top-left light source */}
      <span className="absolute inset-3 rounded-[42%_42%_46%_46%/48%_48%_40%_40%] border border-white/55" />
      <span className="absolute left-[14%] top-[18%] h-20 w-20 rounded-full bg-white/45 blur-2xl" />
      <span className="absolute bottom-[18%] right-[16%] h-16 w-16 rounded-full bg-[#C79A6A]/25 blur-2xl" />

      {/* Speaker face */}
      <div className="relative flex h-[46%] w-[46%] items-center justify-center rounded-full bg-gradient-to-br from-[#EFC08A] via-[#D4954D] to-[#AE6E33] shadow-[inset_0_3px_12px_rgba(255,255,255,0.45),inset_0_-6px_16px_rgba(110,70,32,0.35),0_16px_38px_rgba(184,118,58,0.34)]">
        <span
          className="pointer-events-none absolute inset-x-[12%] top-[8%] h-[38%] rounded-full bg-gradient-to-b from-white/45 to-transparent"
          aria-hidden="true"
        />
        <span className="relative h-9 w-full px-3">
          <Waveform state="speaking" bars={5} />
        </span>
      </div>

      {/* Contact shadow on the surface it rests on */}
      <span className="absolute bottom-[11%] h-2 w-20 rounded-full bg-brown/15 blur-[2px]" />
    </div>
  )
}

/** Phone frame showing a compact Soba conversation surface. */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative w-[240px] shrink-0 rounded-[40px] bg-gradient-to-b from-brown-700 to-brown-900 p-[7px]',
        'shadow-[0_28px_60px_rgba(82,58,40,0.30),inset_0_1px_0_rgba(255,255,255,0.18)]',
        className,
      )}
      role="img"
      aria-label="Illustration of the Soba app on a phone"
    >
      <div className="relative overflow-hidden rounded-[33px] bg-background">
        {/* Notch */}
        <span
          className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-brown-900"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between px-4 pb-2 pt-3 text-[10px] font-semibold text-ink-muted">
          <span className="tabular">9:41</span>
          <span className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            <BatteryMedium className="h-3 w-3" />
          </span>
        </div>

        <div className="px-4 pb-5">
          <p className="text-[11px] font-medium text-ink-muted">Talk to Soba</p>

          <div className="mt-3 flex justify-center">
            <div className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full bg-gradient-to-br from-[#F2DDBE] to-[#D4954D] shadow-[0_10px_26px_rgba(212,149,77,0.38),inset_0_2px_8px_rgba(255,255,255,0.5)]">
              <span
                className="absolute inset-0 animate-breathe rounded-full border border-apricot/30"
                aria-hidden="true"
              />
              <span className="relative h-7 w-full px-4">
                <Waveform state="listening" bars={5} />
              </span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] font-semibold text-brown">Listening</p>

          <div className="mt-4 space-y-2">
            <div className="ml-6 rounded-2xl rounded-tr-md bg-gradient-to-br from-brown-600 to-brown-800 px-3 py-2 text-[10px] leading-relaxed text-cream shadow-card">
              I have been feeling really overwhelmed today.
            </div>
            <div className="mr-4 rounded-2xl rounded-tl-md bg-cream px-3 py-2 text-[10px] leading-relaxed text-brown-dark shadow-card">
              That sounds like a lot to carry. Would you like to talk about it, or slow things down
              first?
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-inset">
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
        'flex animate-float items-center gap-3 rounded-2xl border border-line/80 bg-surface/95 px-4 py-3 shadow-lift backdrop-blur-md',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cream to-cream-deep text-brown shadow-inset">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brown-dark">{title}</p>
        <p className="text-[11px] text-ink-muted">{subtitle}</p>
      </div>
    </div>
  )
}
