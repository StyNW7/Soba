import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { homeRouteFor, useAuth } from '../context/AuthContext'
import type { Role } from '../types'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-apricot border-t-transparent"
          aria-hidden="true"
        />
        <p className="text-sm text-ink-secondary">Loading Soba</p>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady, profile } = useAuth()
  const location = useLocation()

  if (!isReady) return <LoadingScreen />
  if (!isAuthenticated)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (profile?.eligibility !== 'allowed')
    return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export function RoleRoute({
  role,
  children,
}: {
  role: Role
  children: ReactNode
}) {
  const { user, isReady, profile } = useAuth()

  if (!isReady) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profile?.roles.includes(role))
    return <Navigate to={homeRouteFor(user.role)} replace />
  return <>{children}</>
}
