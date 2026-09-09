import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppNotification,
  JournalEntry,
  MemoryItem,
  MoodEntry,
  MoodLabel,
  SafetyAlert,
  SobaDevice,
  TrustedContact,
} from '../types'
import { journalEntries as seedJournal } from '../data/mockJournal'
import { moodEntries as seedMoods } from '../data/mockMood'
import { trustedContacts as seedContacts } from '../data/mockCircle'
import { notifications as seedNotifications } from '../data/mockNotifications'
import { safetyAlerts as seedAlerts } from '../data/mockGuardian'
import { memoryItems as seedMemory, sobaDevice as seedDevice } from '../data/mockDevice'
import { readStorage, writeStorage } from '../lib/storage'

export interface PrivacySettings {
  rememberContext: boolean
  storeSummaries: boolean
  storeTranscripts: boolean
  storeRawAudio: boolean
  shareMoodTrend: boolean
  shareSafetyAlerts: boolean
}

interface AppDataContextValue {
  moods: MoodEntry[]
  addMood: (label: MoodLabel, note?: string) => void
  journal: JournalEntry[]
  addJournal: (entry: Omit<JournalEntry, 'id' | 'private'>) => void
  removeJournal: (id: string) => void
  contacts: TrustedContact[]
  addContact: (contact: Omit<TrustedContact, 'id' | 'avatarInitials'>) => void
  updateContact: (id: string, patch: Partial<TrustedContact>) => void
  removeContact: (id: string) => void
  notifications: AppNotification[]
  markNotificationRead: (id: string) => void
  markAllRead: (audience: 'user' | 'guardian') => void
  pushNotification: (notification: Omit<AppNotification, 'id'>) => void
  alerts: SafetyAlert[]
  acknowledgeAlert: (id: string) => void
  resolveAlert: (id: string) => void
  memory: MemoryItem[]
  addMemory: (text: string, category: MemoryItem['category']) => void
  updateMemory: (id: string, text: string) => void
  removeMemory: (id: string) => void
  device: SobaDevice
  updateDevice: (patch: Partial<SobaDevice>) => void
  privacy: PrivacySettings
  updatePrivacy: (patch: Partial<PrivacySettings>) => void
  safetyModeActive: boolean
  triggerSafetyEscalation: () => void
  clearSafetyEscalation: () => void
  resetDemoData: () => void
}

const defaultPrivacy: PrivacySettings = {
  rememberContext: true,
  storeSummaries: true,
  storeTranscripts: false,
  storeRawAudio: false,
  shareMoodTrend: true,
  shareSafetyAlerts: true,
}

const STORAGE_KEY = 'soba.appdata.v1'

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined)

const scoreFor: Record<MoodLabel, number> = {
  Calm: 78,
  Okay: 68,
  Tired: 61,
  Stressed: 55,
  Overwhelmed: 46,
}

interface PersistShape {
  moods: MoodEntry[]
  journal: JournalEntry[]
  contacts: TrustedContact[]
  notifications: AppNotification[]
  alerts: SafetyAlert[]
  memory: MemoryItem[]
  device: SobaDevice
  privacy: PrivacySettings
}

const seed: PersistShape = {
  moods: seedMoods,
  journal: seedJournal,
  contacts: seedContacts,
  notifications: seedNotifications.filter((n) => n.kind !== 'safety'),
  alerts: seedAlerts,
  memory: seedMemory,
  device: seedDevice,
  privacy: defaultPrivacy,
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistShape>(seed)
  const [safetyModeActive, setSafetyModeActive] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(readStorage<PersistShape>(STORAGE_KEY, seed))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) writeStorage(STORAGE_KEY, state)
  }, [state, hydrated])

  const patch = useCallback((updater: (current: PersistShape) => PersistShape) => {
    setState((current) => updater(current))
  }, [])

  const addMood = useCallback(
    (label: MoodLabel, note?: string) => {
      patch((current) => ({
        ...current,
        moods: [
          {
            id: `m_${Date.now()}`,
            date: 'Today',
            isoDate: new Date().toISOString().slice(0, 10),
            score: scoreFor[label],
            label,
            note,
            source: 'check-in',
          },
          ...current.moods.filter((m) => m.date !== 'Today'),
        ],
      }))
    },
    [patch],
  )

  const addJournal = useCallback(
    (entry: Omit<JournalEntry, 'id' | 'private'>) => {
      patch((current) => ({
        ...current,
        journal: [{ ...entry, id: `j_${Date.now()}`, private: true }, ...current.journal],
      }))
    },
    [patch],
  )

  const removeJournal = useCallback(
    (id: string) => patch((current) => ({ ...current, journal: current.journal.filter((j) => j.id !== id) })),
    [patch],
  )

  const addContact = useCallback(
    (contact: Omit<TrustedContact, 'id' | 'avatarInitials'>) => {
      patch((current) => ({
        ...current,
        contacts: [
          ...current.contacts,
          {
            ...contact,
            id: `c_${Date.now()}`,
            avatarInitials: contact.name.trim().charAt(0).toUpperCase() || 'S',
          },
        ],
      }))
    },
    [patch],
  )

  const updateContact = useCallback(
    (id: string, next: Partial<TrustedContact>) =>
      patch((current) => ({
        ...current,
        contacts: current.contacts.map((c) => (c.id === id ? { ...c, ...next } : c)),
      })),
    [patch],
  )

  const removeContact = useCallback(
    (id: string) =>
      patch((current) => ({ ...current, contacts: current.contacts.filter((c) => c.id !== id) })),
    [patch],
  )

  const markNotificationRead = useCallback(
    (id: string) =>
      patch((current) => ({
        ...current,
        notifications: current.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      })),
    [patch],
  )

  const markAllRead = useCallback(
    (audience: 'user' | 'guardian') =>
      patch((current) => ({
        ...current,
        notifications: current.notifications.map((n) =>
          n.audience === audience ? { ...n, read: true } : n,
        ),
      })),
    [patch],
  )

  const pushNotification = useCallback(
    (notification: Omit<AppNotification, 'id'>) =>
      patch((current) => ({
        ...current,
        notifications: [{ ...notification, id: `n_${Date.now()}` }, ...current.notifications],
      })),
    [patch],
  )

  const acknowledgeAlert = useCallback(
    (id: string) =>
      patch((current) => ({
        ...current,
        alerts: current.alerts.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a)),
      })),
    [patch],
  )

  const resolveAlert = useCallback(
    (id: string) =>
      patch((current) => ({
        ...current,
        alerts: current.alerts.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a)),
      })),
    [patch],
  )

  const addMemory = useCallback(
    (text: string, category: MemoryItem['category']) =>
      patch((current) => ({
        ...current,
        memory: [
          {
            id: `mem_${Date.now()}`,
            text,
            category,
            createdAt: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }),
          },
          ...current.memory,
        ],
      })),
    [patch],
  )

  const updateMemory = useCallback(
    (id: string, text: string) =>
      patch((current) => ({
        ...current,
        memory: current.memory.map((m) => (m.id === id ? { ...m, text } : m)),
      })),
    [patch],
  )

  const removeMemory = useCallback(
    (id: string) => patch((current) => ({ ...current, memory: current.memory.filter((m) => m.id !== id) })),
    [patch],
  )

  const updateDevice = useCallback(
    (next: Partial<SobaDevice>) =>
      patch((current) => ({ ...current, device: { ...current.device, ...next } })),
    [patch],
  )

  const updatePrivacy = useCallback(
    (next: Partial<PrivacySettings>) =>
      patch((current) => ({ ...current, privacy: { ...current.privacy, ...next } })),
    [patch],
  )

  /**
   * Demo-only escalation: simulates Soba moving into Safety Mode, raising a
   * guardian-visible alert and notification. No conversation content is shared.
   */
  const triggerSafetyEscalation = useCallback(() => {
    setSafetyModeActive(true)
    const now = new Date()
    patch((current) => {
      if (current.alerts.some((a) => a.status === 'open')) return current
      return {
        ...current,
        alerts: [
          {
            id: `a_${now.getTime()}`,
            date: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            isoDate: now.toISOString().slice(0, 10),
            title: 'Immediate check-in recommended',
            description:
              'Soba detected a serious wellbeing signal and recommends contacting Nara. No conversation content is shared.',
            severity: 'urgent',
            status: 'open',
          },
          ...current.alerts,
        ],
        notifications: [
          {
            id: `n_${now.getTime()}`,
            title: 'Urgent wellbeing check-in recommended',
            body: 'Soba detected a serious wellbeing signal and recommends contacting Nara.',
            time: 'Just now',
            read: false,
            audience: 'guardian',
            kind: 'safety',
          },
          ...current.notifications,
        ],
      }
    })
  }, [patch])

  const clearSafetyEscalation = useCallback(() => setSafetyModeActive(false), [])

  const resetDemoData = useCallback(() => {
    setState(seed)
    setSafetyModeActive(false)
  }, [])

  const value = useMemo<AppDataContextValue>(
    () => ({
      moods: state.moods,
      addMood,
      journal: state.journal,
      addJournal,
      removeJournal,
      contacts: state.contacts,
      addContact,
      updateContact,
      removeContact,
      notifications: state.notifications,
      markNotificationRead,
      markAllRead,
      pushNotification,
      alerts: state.alerts,
      acknowledgeAlert,
      resolveAlert,
      memory: state.memory,
      addMemory,
      updateMemory,
      removeMemory,
      device: state.device,
      updateDevice,
      privacy: state.privacy,
      updatePrivacy,
      safetyModeActive,
      triggerSafetyEscalation,
      clearSafetyEscalation,
      resetDemoData,
    }),
    [
      state,
      safetyModeActive,
      addMood,
      addJournal,
      removeJournal,
      addContact,
      updateContact,
      removeContact,
      markNotificationRead,
      markAllRead,
      pushNotification,
      acknowledgeAlert,
      resolveAlert,
      addMemory,
      updateMemory,
      removeMemory,
      updateDevice,
      updatePrivacy,
      triggerSafetyEscalation,
      clearSafetyEscalation,
      resetDemoData,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData must be used within an AppDataProvider')
  return context
}
