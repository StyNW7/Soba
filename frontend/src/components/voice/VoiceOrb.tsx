import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

const stateCopy: Record<VoiceState, string> = {
  idle: 'Ready when you are',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
}

interface VoiceOrbProps {
  state: VoiceState
  safetyMode?: boolean
  size?: number
  className?: string
}

/**
 * Abstract voice presence for Soba. Concentric rings around a warm core; the
 * rings respond to conversational state rather than to raw audio, which keeps
 * motion calm and predictable in a mental-health context.
 */
export function VoiceOrb({ state, safetyMode, size = 260, className }: VoiceOrbProps) {
  const active = state === 'listening' || state === 'speaking'

  const palette = safetyMode
    ? { core: '#B5654F', deep: '#8E4B39', light: '#E3B5A6', halo: 'rgba(181,101,79,0.20)', ring: 'rgba(181,101,79,0.32)' }
    : { core: '#D4954D', deep: '#B8763A', light: '#F5E4CB', halo: 'rgba(212,149,77,0.22)', ring: 'rgba(119,85,51,0.24)' }

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Soba is ${stateCopy[state].toLowerCase()}`}
    >
      {/* Ambient halo */}
      <span
        className={cn('absolute rounded-full transition-all duration-1000', active && 'animate-breathe')}
        style={{ inset: 0, background: `radial-gradient(circle, ${palette.halo} 0%, transparent 68%)` }}
      />

      {/* Emitted ring while listening — reads as attention, not activity */}
      {state === 'listening' ? (
        <span
          className="absolute animate-ring-out rounded-full border"
          style={{ inset: size * 0.16, borderColor: palette.ring, borderWidth: 1.5 }}
        />
      ) : null}

      <span
        className={cn(
          'absolute rounded-full border transition-all duration-700',
          state === 'listening' && 'animate-orb-pulse',
        )}
        style={{ inset: size * 0.11, borderColor: palette.ring, borderWidth: 1.5 }}
      />
      <span
        className={cn(
          'absolute rounded-full border transition-all duration-700',
          state === 'thinking' && 'animate-breathe',
        )}
        style={{ inset: size * 0.2, borderColor: palette.ring, borderWidth: 1 }}
      />

      {/* Core */}
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-700',
          active && 'animate-orb-pulse',
        )}
        style={{
          width: size * 0.5,
          height: size * 0.5,
          background: `radial-gradient(circle at 32% 26%, ${palette.light} 0%, ${palette.core} 56%, ${palette.deep} 100%)`,
          boxShadow: `0 18px 50px ${palette.halo}, inset 0 -6px 18px rgba(82,58,40,0.18), inset 0 4px 12px rgba(255,255,255,0.35)`,
        }}
      >
        {/* Specular highlight makes the core read as a sphere, not a flat disc */}
        <span
          className="pointer-events-none absolute rounded-full opacity-70"
          style={{
            inset: '8% 8% 45% 8%',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.55), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <span className="relative h-2/5 w-3/5">
          <Waveform state={state} bars={5} />
        </span>
      </span>
    </div>
  )
}

interface WaveformProps {
  state: VoiceState
  safetyMode?: boolean
  bars?: number
  className?: string
  tone?: 'light' | 'dark'
}

const idleHeights = [22, 34, 26, 40, 28, 32, 20]

export function Waveform({ state, bars = 7, className, tone = 'light' }: WaveformProps) {
  const [heights, setHeights] = useState<number[]>(idleHeights.slice(0, bars))

  useEffect(() => {
    if (state === 'idle') {
      setHeights(Array.from({ length: bars }, (_, i) => idleHeights[i % idleHeights.length] * 0.45))
      return
    }
    if (state === 'thinking') {
      setHeights(Array.from({ length: bars }, () => 18))
      return
    }
    const interval = window.setInterval(() => {
      setHeights(
        Array.from({ length: bars }, (_, index) => {
          // Centre bars swing wider, which reads as a voice rather than noise.
          const centre = 1 - Math.abs(index - (bars - 1) / 2) / bars
          const amplitude = state === 'speaking' ? 62 : 48
          return 14 + Math.random() * amplitude * (0.55 + centre * 0.7)
        }),
      )
    }, 180)
    return () => window.clearInterval(interval)
  }, [state, bars])

  return (
    <span className={cn('flex h-full items-center justify-center gap-[3px]', className)} aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full transition-all duration-200 ease-out',
            tone === 'light' ? 'bg-white/90' : 'bg-brown/70',
          )}
          style={{ height: `${Math.min(height, 88)}%` }}
        />
      ))}
    </span>
  )
}
