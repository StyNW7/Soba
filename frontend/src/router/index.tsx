import { useAuth, homeRouteFor } from '../context/AuthContext'
import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '../layouts/PublicLayout'
import { UserDashboardLayout } from '../layouts/UserDashboardLayout'
import { GuardianDashboardLayout } from '../layouts/GuardianDashboardLayout'
import { ProtectedRoute, RoleRoute } from './guards'
import Home from '../pages/public/Home'

// The landing page ships in the initial bundle; everything else is split so the
// first visit does not pay for the dashboard and charting libraries.
const About = lazy(() => import('../pages/public/About'))
const HowItWorks = lazy(() => import('../pages/public/HowItWorks'))
const Features = lazy(() => import('../pages/public/Features'))
const SafetyPage = lazy(() => import('../pages/public/Safety'))
const SupportPage = lazy(() => import('../pages/public/Support'))
const NotFound = lazy(() => import('../pages/public/NotFound'))

const Login = lazy(() => import('../pages/auth/Login'))
const SignUp = lazy(() => import('../pages/auth/SignUp'))
const Onboarding = lazy(() => import('../pages/auth/Onboarding'))

const UserOverview = lazy(() => import('../pages/user/Overview'))
const MoodPatterns = lazy(() =>
  import('../pages/connected/Wellbeing').then((m) => ({ default: m.MoodPage })),
)
const Journal = lazy(() =>
  import('../pages/connected/Wellbeing').then((m) => ({
    default: m.JournalPage,
  })),
)
const Personalization = lazy(() =>
  import('../pages/connected/Wellbeing').then((m) => ({
    default: m.PersonalizationPage,
  })),
)
const Toolkit = lazy(() =>
  import('../pages/connected/Wellbeing').then((m) => ({
    default: m.ContentPage,
  })),
)
const TalkToSoba = lazy(() =>
  import('../pages/connected/Conversation').then((m) => ({
    default: m.ConversationPage,
  })),
)
const CircleOfTrust = lazy(() =>
  import('../pages/connected/Connections').then((m) => ({
    default: m.CirclePage,
  })),
)
const ProfessionalSupport = lazy(() =>
  import('../pages/connected/Connections').then((m) => ({
    default: m.SupportPage,
  })),
)
const SafetyAlerts = lazy(() =>
  import('../pages/connected/Connections').then((m) => ({
    default: m.AlertsPage,
  })),
)
const MySoba = lazy(() =>
  import('../pages/connected/Devices').then((m) => ({
    default: m.DevicesPage,
  })),
)
const Privacy = lazy(() =>
  import('../pages/connected/Account').then((m) => ({
    default: m.PrivacyPage,
  })),
)
const UserSettings = lazy(() =>
  import('../pages/connected/Account').then((m) => ({
    default: m.SettingsPage,
  })),
)
const GuardianOverview = lazy(() =>
  import('../pages/connected/Guardian').then((m) => ({
    default: m.GuardianPage,
  })),
)

function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-7 w-7 animate-spin rounded-full border-2 border-apricot border-t-transparent"
        aria-hidden="true"
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/features" element={<Features />} />
          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/app" element={<AccountHome />} />
        <Route
          path="/guardian"
          element={<Navigate to="/app/guardian" replace />}
        />
        <Route path="/auth/complete" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route
          path="/app/user"
          element={
            <ProtectedRoute>
              <RoleRoute role="user">
                <UserDashboardLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<UserOverview />} />
          <Route path="soba" element={<TalkToSoba />} />
          <Route path="mood" element={<MoodPatterns />} />
          <Route path="journal" element={<Journal />} />
          <Route path="toolkit" element={<Toolkit />} />
          <Route path="circle" element={<CircleOfTrust />} />
          <Route path="support" element={<ProfessionalSupport />} />
          <Route path="device" element={<MySoba />} />
          <Route path="personalization" element={<Personalization />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>

        <Route
          path="/app/guardian"
          element={
            <ProtectedRoute>
              <RoleRoute role="guardian">
                <GuardianDashboardLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<GuardianOverview />} />
          <Route path="wellbeing" element={<GuardianOverview />} />
          <Route path="trends" element={<GuardianOverview />} />
          <Route path="alerts" element={<SafetyAlerts />} />
          <Route path="reach-out" element={<SafetyAlerts />} />
          <Route path="coach" element={<Toolkit coach />} />
          <Route path="safety" element={<GuardianOverview />} />
          <Route path="settings" element={<UserSettings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function AccountHome() {
  const { user, isReady, profile } = useAuth()
  if (!isReady) return <RouteFallback />
  return (
    <Navigate
      to={
        !user
          ? '/login'
          : profile?.eligibility !== 'allowed'
            ? '/onboarding'
            : homeRouteFor(user.role)
      }
      replace
    />
  )
}
