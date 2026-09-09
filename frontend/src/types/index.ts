export type Role = 'user' | 'guardian'

export type MoodLabel = 'Calm' | 'Okay' | 'Tired' | 'Stressed' | 'Overwhelmed'

export type InteractionPreference = 'listen-first' | 'suggestions' | 'balanced'

export interface User {
  id: string
  name: string
  preferredName: string
  email: string
  role: Role
  ageRange?: string
  interactionPreference?: InteractionPreference
  relationship?: string
  subjectName?: string
  avatarInitials: string
  joinedAt: string
}

export interface Guardian extends User {
  role: 'guardian'
  relationship: string
  subjectName: string
}

export interface MoodEntry {
  id: string
  date: string
  isoDate: string
  score: number
  label: MoodLabel
  note?: string
  source: 'check-in' | 'conversation'
}

export interface JournalEntry {
  id: string
  date: string
  isoDate: string
  title: string
  summary: string
  body: string
  mood: MoodLabel
  source: 'voice' | 'written'
  insights: string[]
  private: true
}

export interface TrustedContact {
  id: string
  name: string
  relationship: string
  phone: string
  status: 'active' | 'invited' | 'unlinked' | 'revoked'
  priority: 'primary' | 'secondary' | 'backup'
  canReceiveAlerts: boolean
  avatarInitials: string
}

export interface Professional {
  id: string
  name: string
  role: string
  specializations: string[]
  location: string
  mode: 'online' | 'in-person' | 'both'
  languages: string[]
  nextAvailable: string
  yearsExperience: number
  avatarInitials: string
  verified: boolean
}

export interface AppNotification {
  id: string
  title: string
  body: string
  time: string
  read: boolean
  audience: Role
  kind: 'reminder' | 'update' | 'connection' | 'safety'
}

export interface SafetyAlert {
  id: string
  date: string
  isoDate: string
  title: string
  description: string
  severity: 'info' | 'elevated' | 'urgent'
  status: 'open' | 'acknowledged' | 'resolved'
}

export interface SobaDevice {
  id: string
  name: string
  status: 'connected' | 'offline' | 'syncing'
  battery: number
  wifi: string
  lastSync: string
  firmware: string
  firmwareUpdatedAt: string
  micEnabled: boolean
  volume: number
  listeningMode: 'always' | 'push-to-talk' | 'wake-word'
  hapticGuidance: boolean
  nightMode: boolean
  voicePersonality: 'calm' | 'friendly' | 'encouraging'
}

export interface MemoryItem {
  id: string
  text: string
  category: 'context' | 'preference' | 'routine'
  createdAt: string
}

export interface WellbeingMetric {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'steady'
  hint?: string
}

export interface ToolkitActivity {
  id: string
  title: string
  category: 'Grounding' | 'Breathing' | 'Reflection' | 'Wind Down' | 'Mindful Break'
  durationMinutes: number
  description: string
  steps: { title: string; instruction: string; seconds: number }[]
}

export interface CoachModule {
  id: string
  title: string
  duration: string
  summary: string
  category: string
  body: string[]
}

export interface ConversationTurn {
  id: string
  speaker: 'user' | 'soba'
  text: string
  time: string
  mode?: 'standard' | 'safety'
}
