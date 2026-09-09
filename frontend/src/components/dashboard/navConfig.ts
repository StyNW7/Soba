import {
  Activity,
  Bell,
  BookOpenText,
  Cpu,
  LayoutDashboard,
  LockKeyhole,
  MessageCircle,
  Mic,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const userNav: NavItem[] = [
  { to: '/app/user', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/user/soba', label: 'Talk to Soba', icon: Mic },
  { to: '/app/user/mood', label: 'Mood & Patterns', icon: TrendingUp },
  { to: '/app/user/journal', label: 'Journal', icon: NotebookPen },
  { to: '/app/user/toolkit', label: 'Toolkit', icon: Wind },
  { to: '/app/user/circle', label: 'Circle of Trust', icon: Users },
  { to: '/app/user/support', label: 'Professional Support', icon: Stethoscope },
  { to: '/app/user/device', label: 'My Soba', icon: Cpu },
  { to: '/app/user/personalization', label: 'Personalization', icon: Sparkles },
  { to: '/app/user/privacy', label: 'Privacy', icon: LockKeyhole },
  { to: '/app/user/settings', label: 'Settings', icon: Settings },
]

export const guardianNav: NavItem[] = [
  { to: '/app/guardian', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/guardian/wellbeing', label: 'Wellbeing Pulse', icon: Activity },
  { to: '/app/guardian/trends', label: 'Mood Trends', icon: TrendingUp },
  { to: '/app/guardian/alerts', label: 'Safety Alerts', icon: Bell },
  { to: '/app/guardian/reach-out', label: 'Reach Out', icon: MessageCircle },
  { to: '/app/guardian/coach', label: 'Parent Coach', icon: BookOpenText },
  { to: '/app/guardian/safety', label: 'Safety & Connection', icon: ShieldCheck },
  { to: '/app/guardian/settings', label: 'Settings', icon: Settings },
]

/** Mobile bottom navigation keeps at most five destinations. */
export const userMobileNav: NavItem[] = [
  { to: '/app/user', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/user/soba', label: 'Soba', icon: Mic },
  { to: '/app/user/mood', label: 'Mood', icon: TrendingUp },
  { to: '/app/user/toolkit', label: 'Toolkit', icon: Wind },
]

export const guardianMobileNav: NavItem[] = [
  { to: '/app/guardian', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/app/guardian/trends', label: 'Trends', icon: TrendingUp },
  { to: '/app/guardian/alerts', label: 'Alerts', icon: Bell },
  { to: '/app/guardian/coach', label: 'Coach', icon: BookOpenText },
]
