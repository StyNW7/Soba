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
 * Abstract voice presence for Soba. Two soft rings plus a warm core; the rings
 * respond to conversational state rather than to raw audio, keeping motion calm.
 */
export function VoiceOrb({ state, safetyMode, size = 260, className }: VoiceOrbProps) {
  const active = state === 'listening' || state === 'speaking'
  const core = safetyMode ? '#B5654F' : '#D4954D'
  const halo = safetyMode ? 'rgba(181,101,79,0.20)' : 'rgba(212,149,77,0.22)'
  const ring = safetyMode ? 'rgba(181,101,79,0.35)' : 'rgba(119,85,51,0.28)'

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Soba is ${stateCopy[state].toLowerCase()}`}
    >
      <span
        className={cn('absolute rounded-full transition-all duration-1000', active && 'animate-breathe')}
        style={{ inset: 0, background: `radial-gradient(circle, ${halo} 0%, transparent 68%)` }}
      />
      <span
        className={cn(
          'absolute rounded-full border transition-all duration-700',
          state === 'listening' && 'animate-orb-pulse',
        )}
        style={{ inset: size * 0.11, borderColor: ring, borderWidth: 1.5 }}
      />
      <span
        className={cn(
          'absolute rounded-full border transition-all duration-700',
          state === 'thinking' && 'animate-breathe',
        )}
        style={{ inset: size * 0.2, borderColor: ring, borderWidth: 1 }}
      />
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full shadow-[0_18px_50px_rgba(82,58,40,0.18)] transition-all duration-700',
          active && 'animate-orb-pulse',
        )}
        style={{
          width: size * 0.5,
          height: size * 0.5,
          background: `radial-gradient(circle at 32% 28%, #F5E4CB 0%, ${core} 58%, ${safetyMode ? '#8E4B39' : '#B8763A'} 100%)`,
        }}
      >
        <Waveform state={state} safetyMode={safetyMode} />
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
          const center = 1 - Math.abs(index - (bars - 1) / 2) / bars
          const amplitude = state === 'speaking' ? 62 : 48
          return 14 + Math.random() * amplitude * (0.55 + center * 0.7)
        }),
      )
    }, 180)
    return () => window.clearInterval(interval)
  }, [state, bars])

  return (
    <span
      className={cn('flex h-full items-center justify-center gap-[3px]', className)}
      aria-hidden="true"
    >
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            'w-[3px] rounded-full transition-all duration-200 ease-out',
            tone === 'light' ? 'bg-white/85' : 'bg-brown/70',
          )}
          style={{ height: `${Math.min(height, 76)}%` }}
        />
      ))}
    </span>
  )
}
