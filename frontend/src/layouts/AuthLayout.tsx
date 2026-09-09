import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Logo } from '../components/ui/Brand'
import { Waveform } from '../components/voice/VoiceOrb'

interface AuthLayoutProps {
  children: ReactNode
  quote?: string
  attribution?: string
}

export function AuthLayout({
  children,
  quote = 'A safe space starts with being heard.',
  attribution = 'The Soba philosophy',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Editorial brand panel */}
      <aside className="mesh-deep grain relative hidden overflow-hidden bg-gradient-to-br from-brown-600 via-brown-800 to-brown-900 px-12 py-14 text-cream lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-10 h-[420px] w-[420px] rounded-full bg-apricot/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-[360px] w-[360px] rounded-full bg-custard/10 blur-3xl"
        />

        <Logo to="/" variant="light" />

        <div className="relative max-w-lg">
          <p className="font-serif text-[46px] leading-[1.12] tracking-headline text-cream">{quote}</p>
          <p className="mt-6 inline-flex items-center gap-2.5 text-sm uppercase tracking-eyebrow text-custard">
            <span className="h-px w-7 bg-custard/50" aria-hidden="true" />
            {attribution}
          </p>

          <div className="mt-12 flex items-center gap-4 rounded-3xl border border-cream/15 bg-cream/[0.06] p-5 backdrop-blur-sm">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8B478] to-[#B8763A] shadow-[0_8px_22px_rgba(184,118,58,0.4)]">
              <span className="h-5 w-9">
                <Waveform state="speaking" bars={5} />
              </span>
            </span>
            <div>
              <p className="text-sm font-semibold text-cream">Soba is listening</p>
              <p className="mt-0.5 text-xs leading-relaxed text-cream/65">
                Voice first, private by default, human connected.
              </p>
            </div>
          </div>
        </div>

        <p className="relative inline-flex items-center gap-2 text-xs text-cream/60">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Designed for support, not diagnosis.
        </p>
      </aside>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:min-h-0 lg:justify-center lg:px-14 lg:py-16">
        <div className="mb-8 lg:hidden">
          <Logo to="/" />
        </div>
        <div className="mx-auto w-full max-w-md flex-1 lg:flex-none">{children}</div>
      </div>
    </div>
  )
}
