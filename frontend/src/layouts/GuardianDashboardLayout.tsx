import { DashboardShell } from '../components/dashboard/DashboardShell'
import { guardianMobileNav, guardianNav } from '../components/dashboard/navConfig'

export function GuardianDashboardLayout() {
  return (
    <DashboardShell
      nav={guardianNav}
      mobileNav={guardianMobileNav}
      role="guardian"
      roleLabel="Guardian view"
      footerNote="Private conversations remain private. You see wellbeing patterns and safety signals only."
    />
  )
}
