import { DashboardShell } from '../components/dashboard/DashboardShell'
import { userMobileNav, userNav } from '../components/dashboard/navConfig'

export function UserDashboardLayout() {
  return (
    <DashboardShell
      nav={userNav}
      mobileNav={userMobileNav}
      role="user"
      roleLabel="Your space"
      footerNote="Your conversations stay private. You choose what is saved and who can reach you."
    />
  )
}
