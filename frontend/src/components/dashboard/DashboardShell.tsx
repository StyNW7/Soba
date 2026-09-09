import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  LogOut,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { readStorage, writeStorage } from '../../lib/storage'
import { Logo } from '../ui/Brand'
import { Avatar } from '../ui/Badge'
import { Dropdown, DropdownItem } from '../ui/Controls'
import { useAuth } from '../../context/AuthContext'
import { NotificationBell, NotificationCenter } from './NotificationCenter'
import type { NavItem } from './navConfig'
import type { Role } from '../../types'

const COLLAPSE_KEY = 'soba.sidebar.collapsed'

interface DashboardShellProps {
  nav: NavItem[]
  mobileNav: NavItem[]
  role: Role
  roleLabel: string
  footerNote: string
}

export function DashboardShell({ nav, mobileNav, role, roleLabel, footerNote }: DashboardShellProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setCollapsed(readStorage<boolean>(COLLAPSE_KEY, false))
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeStorage(COLLAPSE_KEY, !current)
      return !current
    })
  }, [])

  // Keyboard shortcut, matching the convention most dashboards use.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleCollapsed])

  useEffect(() => {
    setSidebarOpen(false)
    setMoreOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  const current = nav.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  /** `railMode` renders the icon-only sidebar; the drawer always shows labels. */
  const sidebarContent = (railMode: boolean, onDismiss?: () => void) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-[72px] shrink-0 items-center',
          railMode ? 'justify-center px-2' : 'justify-between px-5',
        )}
      >
        <Logo showWordmark={!railMode} />
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl p-2 text-ink-muted transition hover:bg-muted lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {!railMode ? (
        <div className="px-5 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {roleLabel}
          </p>
        </div>
      ) : (
        <div className="mx-auto mb-3 h-px w-8 bg-line" aria-hidden="true" />
      )}

      <nav
        aria-label="Dashboard"
        className={cn('flex-1 overflow-y-auto overflow-x-hidden pb-4', railMode ? 'px-2' : 'px-3')}
      >
        <ul className="space-y-1">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                title={railMode ? item.label : undefined}
                aria-label={railMode ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200 ease-soba',
                    railMode ? 'h-11 w-full justify-center' : 'gap-3 px-3.5 py-2.5',
                    isActive
                      ? 'bg-gradient-to-r from-apricot-100 to-apricot-50 text-brown-dark shadow-[inset_0_0_0_1px_rgba(212,149,77,0.22)]'
                      : 'text-ink-secondary hover:bg-cream/70 hover:text-brown-dark',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Indicator rail: vertical bar when expanded, dot when collapsed */}
                    <span
                      className={cn(
                        'absolute rounded-full bg-gradient-to-b from-apricot-400 to-apricot transition-all duration-300 ease-soba',
                        railMode
                          ? 'bottom-1 left-1/2 h-1 -translate-x-1/2'
                          : 'left-0 top-1/2 w-1 -translate-y-1/2',
                        isActive
                          ? railMode
                            ? 'w-4 opacity-100'
                            : 'h-5 opacity-100'
                          : railMode
                            ? 'w-0 opacity-0'
                            : 'h-0 opacity-0',
                      )}
                      aria-hidden="true"
                    />
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors duration-200',
                        isActive ? 'text-apricot-700' : 'text-brown-soft group-hover:text-brown',
                      )}
                      aria-hidden="true"
                    />
                    {railMode ? (
                      <span className="pointer-events-none absolute left-[calc(100%+12px)] z-50 hidden -translate-x-1 whitespace-nowrap rounded-xl bg-brown-dark px-3 py-2 text-xs font-medium text-cream opacity-0 shadow-lift transition-all duration-200 ease-soba group-hover:block group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:block group-focus-visible:translate-x-0 group-focus-visible:opacity-100 lg:block">
                        {item.label}
                      </span>
                    ) : (
                      <span className="truncate">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('shrink-0 border-t border-line', railMode ? 'p-2' : 'p-4')}>
        {railMode ? (
          <div className="flex justify-center py-2" title={footerNote}>
            <ShieldCheck className="h-4 w-4 text-sage" aria-label={footerNote} />
          </div>
        ) : (
          <div className="rounded-2xl bg-cream/70 p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-brown">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-sage" aria-hidden="true" />
              {footerNote}
            </p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brown focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-gradient-to-b from-surface to-cream-tint/40 transition-[width] duration-300 ease-soba lg:block',
          collapsed ? 'w-[76px]' : 'w-[272px]',
        )}
      >
        {sidebarContent(collapsed)}

        {/* Collapse handle sits on the sidebar edge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="dashboard-main"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
          className="absolute -right-3.5 top-[84px] flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-brown-soft shadow-soft transition-all duration-200 ease-soba hover:scale-110 hover:border-apricot-300 hover:text-apricot hover:shadow-lift active:scale-95"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* Mobile / tablet drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-brown-dark/35 animate-fade-in"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-surface shadow-lift animate-slide-in-right">
            {sidebarContent(false, () => setSidebarOpen(false))}
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          'transition-[padding] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[272px]',
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-line/80 bg-background/75 shadow-[0_1px_16px_rgba(82,58,40,0.04)] backdrop-blur-xl backdrop-saturate-150">
          <div
            className={cn(
              'mx-auto flex h-[72px] w-full items-center justify-between gap-4 px-4 transition-[max-width] duration-300 sm:px-6 lg:px-8',
              collapsed ? 'max-w-[1560px]' : 'max-w-[1400px]',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-brown transition hover:bg-cream lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-[18px] w-[18px]" />
              </button>

              {/* Desktop toggle, mirrored in the header for discoverability */}
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-brown transition hover:bg-cream lg:flex"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
                )}
              </button>

              <div className="min-w-0">
                <p className="hidden text-xs text-ink-muted sm:flex sm:items-center sm:gap-1">
                  Soba
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  {roleLabel}
                </p>
                <p className="truncate text-[15px] font-semibold text-brown-dark">
                  {current?.label ?? 'Overview'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <NotificationBell audience={role} onClick={() => setNotificationsOpen(true)} />
              <Dropdown
                label="Account menu"
                trigger={
                  <span className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1.5 pl-1.5 pr-3 transition hover:bg-cream">
                    <Avatar initials={user?.avatarInitials ?? 'S'} size="sm" />
                    <span className="hidden text-sm font-medium text-brown-dark sm:block">
                      {user?.preferredName ?? 'Account'}
                    </span>
                  </span>
                }
              >
                <div className="border-b border-line px-3 py-2.5">
                  <p className="text-sm font-semibold text-brown-dark">{user?.name}</p>
                  <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                </div>
                <div className="pt-1.5">
                  <DropdownItem
                    onClick={() =>
                      navigate(role === 'guardian' ? '/app/guardian/settings' : '/app/user/settings')
                    }
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Settings
                  </DropdownItem>
                  <DropdownItem tone="danger" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </DropdownItem>
                </div>
              </Dropdown>
            </div>
          </div>
        </header>

        <main
          id="dashboard-main"
          className={cn(
            'mx-auto w-full px-4 pb-28 pt-7 transition-[max-width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] sm:px-6 lg:px-8 lg:pb-14',
            collapsed ? 'max-w-[1560px]' : 'max-w-[1400px]',
          )}
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="flex items-stretch">
          {mobileNav.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors duration-200',
                    isActive ? 'text-apricot-700' : 'text-ink-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-apricot to-custard transition-opacity duration-300',
                        isActive ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden="true"
                    />
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-ink-muted"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* "More" bottom sheet */}
      {moreOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-brown-dark/35 animate-fade-in"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-0 max-h-[76vh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift animate-scale-in"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-brown-dark">All destinations</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-xl p-2 text-ink-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2.5">
              {nav.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-cream/40 p-4 text-sm font-medium text-brown-dark"
                  >
                    <item.icon className="h-5 w-5 text-brown-soft" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        audience={role}
      />
    </div>
  )
}
