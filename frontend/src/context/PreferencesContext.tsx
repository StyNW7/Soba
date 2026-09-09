import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { readStorage, writeStorage } from '../lib/storage'

export type TextSize = 'default' | 'large'

interface Preferences {
  textSize: TextSize
  highContrast: boolean
  reducedMotion: boolean
}

interface PreferencesContextValue extends Preferences {
  setTextSize: (size: TextSize) => void
  setHighContrast: (value: boolean) => void
  setReducedMotion: (value: boolean) => void
}

const STORAGE_KEY = 'soba.preferences'

const defaults: Preferences = {
  textSize: 'default',
  highContrast: false,
  reducedMotion: false,
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(defaults)

  useEffect(() => {
    setPreferences(readStorage<Preferences>(STORAGE_KEY, defaults))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--soba-text-scale', preferences.textSize === 'large' ? '1.125' : '1')
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal'
    root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full'
    writeStorage(STORAGE_KEY, preferences)
  }, [preferences])

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ...preferences,
      setTextSize: (textSize) => setPreferences((p) => ({ ...p, textSize })),
      setHighContrast: (highContrast) => setPreferences((p) => ({ ...p, highContrast })),
      setReducedMotion: (reducedMotion) => setPreferences((p) => ({ ...p, reducedMotion })),
    }),
    [preferences],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider')
  return context
}
