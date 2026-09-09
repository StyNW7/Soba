import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Role, User } from '../types'
import { demoGuardian, demoUser } from '../data/mockUser'
import { clearStorage, readStorage, writeStorage } from '../lib/storage'
import { initials } from '../lib/format'

const STORAGE_KEY = 'soba.auth.user'

export interface SignUpPayload {
  name: string
  email: string
  password: string
  role: Role
  preferredName?: string
  ageRange?: string
  interactionPreference?: User['interactionPreference']
  relationship?: string
  subjectName?: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
  signIn: (email: string, password: string) => Promise<User>
  signInAs: (role: Role) => Promise<User>
  signUp: (payload: SignUpPayload) => Promise<User>
  updateUser: (patch: Partial<User>) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Mock authentication. Everything here is local-only; a real API client can
 * replace the promise bodies without touching consumers.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setUser(readStorage<User | null>(STORAGE_KEY, null))
    setIsReady(true)
  }, [])

  const persist = useCallback((next: User | null) => {
    setUser(next)
    if (next) writeStorage(STORAGE_KEY, next)
    else clearStorage(STORAGE_KEY)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      await new Promise((resolve) => setTimeout(resolve, 550))
      const normalized = email.trim().toLowerCase()
      if (!normalized.includes('@')) throw new Error('Please enter a valid email address.')
      if (password.length < 6) throw new Error('Your password should be at least 6 characters.')

      const account =
        normalized === demoGuardian.email ? demoGuardian : normalized === demoUser.email ? demoUser : null

      const next: User = account ?? {
        ...demoUser,
        id: `usr_${normalized.split('@')[0]}`,
        email: normalized,
        name: normalized.split('@')[0],
        preferredName: normalized.split('@')[0],
        avatarInitials: initials(normalized.split('@')[0]) || 'S',
      }
      persist(next)
      return next
    },
    [persist],
  )

  const signInAs = useCallback(
    async (role: Role) => {
      await new Promise((resolve) => setTimeout(resolve, 350))
      const next = role === 'guardian' ? demoGuardian : demoUser
      persist(next)
      return next
    },
    [persist],
  )

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      await new Promise((resolve) => setTimeout(resolve, 650))
      const next: User = {
        id: `usr_${Date.now()}`,
        name: payload.name,
        preferredName: payload.preferredName?.trim() || payload.name.split(' ')[0],
        email: payload.email.trim().toLowerCase(),
        role: payload.role,
        ageRange: payload.ageRange,
        interactionPreference: payload.interactionPreference,
        relationship: payload.relationship,
        subjectName: payload.subjectName ?? (payload.role === 'guardian' ? 'Nara' : undefined),
        avatarInitials: initials(payload.name) || 'S',
        joinedAt: new Date().toISOString().slice(0, 10),
      }
      persist(next)
      return next
    },
    [persist],
  )

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      setUser((current) => {
        if (!current) return current
        const next = { ...current, ...patch }
        writeStorage(STORAGE_KEY, next)
        return next
      })
    },
    [],
  )

  const signOut = useCallback(() => persist(null), [persist])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isReady,
      signIn,
      signInAs,
      signUp,
      updateUser,
      signOut,
    }),
    [user, isReady, signIn, signInAs, signUp, updateUser, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

// eslint-disable-next-line react-refresh/only-export-components
export function homeRouteFor(role: Role) {
  return role === 'guardian' ? '/app/guardian' : '/app/user'
}
