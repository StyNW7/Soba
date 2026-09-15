import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { api, ApiError, resetSession } from '../api/client'
import type { Profile, ProfileUpdate } from '../api/schema'
import type { Role, User } from '../types'
import { clearStorage } from '../lib/storage'
import { initials } from '../lib/format'

interface AuthContextValue {
  profile: Profile | null
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
  error: string
  refresh: () => Promise<void>
  startLogin: () => Promise<void>
  saveProfile: (value: ProfileUpdate) => Promise<void>
  updateUser: (patch: Partial<User>) => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++generation.current
    try {
      const next = await api<Profile>('/v1/me')
      if (current === generation.current) {
        setProfile(next)
        setError('')
      }
    } catch (err) {
      if (current !== generation.current) return
      setProfile(null)
      if (!(err instanceof ApiError && err.status === 401))
        setError(err instanceof Error ? err.message : 'Cannot connect to SOBA.')
    } finally {
      if (current === generation.current) setIsReady(true)
    }
  }, [])
  useEffect(() => {
    for (const key of [
      'soba.auth.user',
      'soba.appdata.v2',
      'soba.signup.draft',
    ])
      clearStorage(key)
    void refresh()
    const clear = () => {
      generation.current++
      setProfile(null)
      setIsReady(true)
    }
    window.addEventListener('soba:unauthenticated', clear)
    return () => window.removeEventListener('soba:unauthenticated', clear)
  }, [refresh])

  const startLogin = async () => {
    resetSession()
    const result = await api<{ authorization_url: string }>('/v1/auth/start', {
      method: 'POST',
      public: true,
      body: { client: 'web', return_path: '/app' },
    })
    window.location.assign(result.authorization_url)
  }
  const saveProfile = async (body: ProfileUpdate) => {
    setProfile(await api<Profile>('/v1/me', { method: 'PATCH', body }))
  }
  const updateUser = async (patch: Partial<User>) => {
    if (!profile) throw new Error('Please sign in.')
    await saveProfile({
      display_name: patch.preferredName ?? patch.name ?? profile.display_name,
      locale: profile.locale,
      timezone: profile.timezone,
      roles: profile.roles,
      age_band: profile.age_band,
      shared_phone: profile.shared_phone,
      version: profile.version,
    })
  }
  const signOut = async () => {
    await api('/v1/auth/logout', { method: 'POST' })
    resetSession()
    setProfile(null)
  }
  const user: User | null = profile
    ? {
        id: profile.id,
        name: profile.display_name,
        preferredName: profile.display_name,
        email: '',
        role: profile.roles.includes('user') ? 'user' : 'guardian',
        avatarInitials: initials(profile.display_name),
        joinedAt: '',
      }
    : null
  return (
    <AuthContext.Provider
      value={{
        profile,
        user,
        isAuthenticated: !!profile,
        isReady,
        error,
        refresh,
        startLogin,
        saveProfile,
        updateUser,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
export function homeRouteFor(role: Role) {
  return role === 'guardian' ? '/app/guardian' : '/app/user'
}
