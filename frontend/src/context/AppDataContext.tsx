import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppNotification,
  JournalEntry,
  MemoryItem,
  MoodEntry,
  MoodLabel,
  Personalization,
  Referral,
  SafetyAlert,
  SobaDevice,
  SupportRequest,
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
  device: SobaDevice | null
  updateDevice: (patch: Partial<SobaDevice>) => void
  pairDevice: (name: string) => void
  unpairDevice: () => void
  personalization: Personalization
  updatePersonalization: (patch: Partial<Personalization>) => void
  privacy: PrivacySettings
  updatePrivacy: (patch: Partial<PrivacySettings>) => void
  supportRequests: SupportRequest[]
  createSupportRequest: (request: Omit<SupportRequest, 'id' | 'createdAt' | 'expiresAt' | 'status'>) => string
  advanceSupportRequest: (id: string, status: SupportRequest['status']) => void
  referrals: Referral[]
  createReferral: (referral: Omit<Referral, 'id' | 'createdAt' | 'status'>) => void
  updateReferral: (id: string, status: Referral['status']) => void
  removeReferral: (id: string) => void
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

const defaultPersonalization: Personalization = {
  personality: 'calm',
  voiceId: 'marin',
  listenFirst: true,
  useMemory: true,
  adaptiveTone: true,
}

const STORAGE_KEY = 'soba.appdata.v2'

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
  device: SobaDevice | null
  personalization: Personalization
  privacy: PrivacySettings
  supportRequests: SupportRequest[]
  referrals: Referral[]
}

const seed: PersistShape = {
  moods: seedMoods,
  journal: seedJournal,
  contacts: seedContacts,
  notifications: seedNotifications.filter((n) => n.kind !== 'safety'),
  alerts: seedAlerts,
  memory: seedMemory,
  device: seedDevice,
  personalization: defaultPersonalization,
  privacy: defaultPrivacy,
  supportRequests: [],
  referrals: [],
}

function today() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistShape>(seed)
  const [safetyModeActive, setSafetyModeActive] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStorage<PersistShape | null>(STORAGE_KEY, null)
    // Merge rather than replace so a stored payload from an earlier build still
    // gains any keys added since it was written.
    setState(stored ? { ...seed, ...stored } : seed)
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
        memory: [{ id: `mem_${Date.now()}`, text, category, createdAt: today() }, ...current.memory],
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
      patch((current) => ({
        ...current,
        device: current.device ? { ...current.device, ...next } : current.device,
      })),
    [patch],
  )

  const pairDevice = useCallback(
    (name: string) =>
      patch((current) => ({
        ...current,
        device: { ...seedDevice, name: name.trim() || seedDevice.name, lastSync: 'Just now' },
      })),
    [patch],
  )

  const unpairDevice = useCallback(() => patch((current) => ({ ...current, device: null })), [patch])

  const updatePersonalization = useCallback(
    (next: Partial<Personalization>) =>
      patch((current) => ({ ...current, personalization: { ...current.personalization, ...next } })),
    [patch],
  )

  const updatePrivacy = useCallback(
    (next: Partial<PrivacySettings>) =>
      patch((current) => ({ ...current, privacy: { ...current.privacy, ...next } })),
    [patch],
  )

  const createSupportRequest = useCallback(
    (request: Omit<SupportRequest, 'id' | 'createdAt' | 'expiresAt' | 'status'>) => {
      const id = `req_${Date.now()}`
      patch((current) => ({
        ...current,
        supportRequests: [
          {
            ...request,
            id,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            expiresAt: Date.now() + 30 * 60 * 1000,
            status: 'queued',
          },
          ...current.supportRequests,
        ],
      }))
      return id
    },
    [patch],
  )

  const advanceSupportRequest = useCallback(
    (id: string, status: SupportRequest['status']) =>
      patch((current) => ({
        ...current,
        supportRequests: current.supportRequests.map((r) => (r.id === id ? { ...r, status } : r)),
      })),
    [patch],
  )

  const createReferral = useCallback(
    (referral: Omit<Referral, 'id' | 'createdAt' | 'status'>) =>
      patch((current) => ({
        ...current,
        referrals: [
          { ...referral, id: `ref_${Date.now()}`, createdAt: today(), status: 'reported-by-you' },
          ...current.referrals,
        ],
      })),
    [patch],
  )

  const updateReferral = useCallback(
    (id: string, status: Referral['status']) =>
      patch((current) => ({
        ...current,
        referrals: current.referrals.map((r) => (r.id === id ? { ...r, status } : r)),
      })),
    [patch],
  )

  const removeReferral = useCallback(
    (id: string) =>
      patch((current) => ({ ...current, referrals: current.referrals.filter((r) => r.id !== id) })),
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
            date: today(),
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
      pairDevice,
      unpairDevice,
      personalization: state.personalization,
      updatePersonalization,
      privacy: state.privacy,
      updatePrivacy,
      supportRequests: state.supportRequests,
      createSupportRequest,
      advanceSupportRequest,
      referrals: state.referrals,
      createReferral,
      updateReferral,
      removeReferral,
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
      pairDevice,
      unpairDevice,
      updatePersonalization,
      updatePrivacy,
      createSupportRequest,
      advanceSupportRequest,
      createReferral,
      updateReferral,
      removeReferral,
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
