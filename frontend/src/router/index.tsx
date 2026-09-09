import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
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
const TalkToSoba = lazy(() => import('../pages/user/TalkToSoba'))
const MoodPatterns = lazy(() => import('../pages/user/MoodPatterns'))
const Journal = lazy(() => import('../pages/user/Journal'))
const Toolkit = lazy(() => import('../pages/user/Toolkit'))
const CircleOfTrust = lazy(() => import('../pages/user/CircleOfTrust'))
const ProfessionalSupport = lazy(() => import('../pages/user/ProfessionalSupport'))
const MySoba = lazy(() => import('../pages/user/MySoba'))
const Privacy = lazy(() => import('../pages/user/Privacy'))
const UserSettings = lazy(() => import('../pages/user/Settings'))

const GuardianOverview = lazy(() => import('../pages/guardian/Overview'))
const WellbeingPulse = lazy(() => import('../pages/guardian/WellbeingPulse'))
const MoodTrends = lazy(() => import('../pages/guardian/MoodTrends'))
const SafetyAlerts = lazy(() => import('../pages/guardian/SafetyAlerts'))
const ReachOut = lazy(() => import('../pages/guardian/ReachOut'))
const ParentCoach = lazy(() => import('../pages/guardian/ParentCoach'))
const SafetyConnection = lazy(() => import('../pages/guardian/SafetyConnection'))
const GuardianSettings = lazy(() => import('../pages/guardian/Settings'))

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
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
          <Route path="wellbeing" element={<WellbeingPulse />} />
          <Route path="trends" element={<MoodTrends />} />
          <Route path="alerts" element={<SafetyAlerts />} />
          <Route path="reach-out" element={<ReachOut />} />
          <Route path="coach" element={<ParentCoach />} />
          <Route path="safety" element={<SafetyConnection />} />
          <Route path="settings" element={<GuardianSettings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
