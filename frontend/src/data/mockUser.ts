import type { User } from '../types'

export const demoUser: User = {
  id: 'usr_nara',
  name: 'Nara Amelia',
  preferredName: 'Nara',
  email: 'user@soba.demo',
  role: 'user',
  ageRange: '18-24',
  interactionPreference: 'listen-first',
  avatarInitials: 'NA',
  joinedAt: '2026-05-12',
}

export const demoGuardian: User = {
  id: 'usr_maria',
  name: 'Maria Amelia',
  preferredName: 'Maria',
  email: 'guardian@soba.demo',
  role: 'guardian',
  relationship: 'Mother',
  subjectName: 'Nara',
  avatarInitials: 'MA',
  joinedAt: '2026-05-14',
}

export const demoCredentials = [
  { email: 'user@soba.demo', password: 'soba1234', role: 'user' as const },
  { email: 'guardian@soba.demo', password: 'soba1234', role: 'guardian' as const },
]
