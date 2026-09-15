import { SobaBear } from '../ui/SobaBear'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Logo } from '../ui/Brand'
import { Button, ButtonLink } from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { homeRouteFor } from '../../context/AuthContext'

const links = [
  { to: '/', label: 'Home' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/features', label: 'Features' },
  { to: '/safety', label: 'Safety' },
  { to: '/support', label: 'Support' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 ease-soba',
        scrolled
          ? 'border-b border-line/70 bg-background/75 shadow-[0_1px_20px_rgba(82,58,40,0.05)] backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav className="container-soba flex h-[72px] items-center justify-between gap-4" aria-label="Main">
        <Logo />

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-soba',
                    isActive
                      ? 'text-brown-dark'
                      : 'text-ink-secondary hover:bg-cream/60 hover:text-brown-dark',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    <span
                      className={cn(
                        'absolute bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full bg-gradient-to-r from-apricot to-custard transition-all duration-300 ease-soba',
                        isActive ? 'w-5 opacity-100' : 'w-0 opacity-0',
                      )}
                      aria-hidden="true"
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2.5 lg:flex">
          {user ? (
            <ButtonLink to={homeRouteFor(user.role)} size="sm">
              Open Soba
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log In
              </ButtonLink>
              <ButtonLink to="/signup" size="sm">
                Get Started
              </ButtonLink>
            </>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </nav>

      {open ? (
        <div className="fixed inset-x-0 top-[72px] bottom-0 z-50 overflow-y-auto border-t border-line bg-background px-5 pb-10 pt-6 lg:hidden">
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-2xl px-4 py-3.5 text-base font-medium transition-colors',
                      isActive ? 'bg-cream text-brown-dark' : 'text-ink-secondary hover:bg-muted',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-3">
            {user ? (
              <ButtonLink to={homeRouteFor(user.role)} size="lg" fullWidth>
                Open Soba
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/signup" size="lg" fullWidth>
                  Get Started
                </ButtonLink>
                <ButtonLink to="/login" variant="secondary" size="lg" fullWidth>
                  Log In
                </ButtonLink>
              </>
            )}
          </div>
          <p className="mt-8 text-xs leading-relaxed text-ink-muted">
            Soba is an emotional support companion and is not a substitute for professional mental
            health care.
          </p>
        </div>
      ) : null}
    </header>
  )
}

export function Footer() {
  const groups = [
    {
      title: 'Product',
      links: [
        { to: '/about', label: 'About' },
        { to: '/features', label: 'Features' },
        { to: '/how-it-works', label: 'How It Works' },
      ],
    },
    {
      title: 'Safety',
      links: [
        { to: '/safety', label: 'Privacy' },
        { to: '/safety', label: 'AI Safety' },
        { to: '/support', label: 'Support' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { to: '/support', label: 'Help Center' },
        { to: '/support', label: 'Professional Support' },
      ],
    },
    {
      title: 'Company',
      links: [
        { to: '/about', label: 'Contact' },
        { to: '/about', label: 'Team' },
      ],
    },
  ]

  return (
    <footer className="grain relative border-t border-line bg-gradient-to-b from-cream/70 to-cream/40">
      <div className="container-soba py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-4">
              <Logo to="" />
              <SobaBear pose="walking" className="w-14" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-secondary">
              A voice-first emotional companion that listens without judgment, supports everyday
              wellbeing, and helps you reach the people who matter.
            </p>
            <p className="mt-5 text-sm font-medium text-brown">Listen. Support. Connect.</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-brown-dark">{group.title}</h3>
                <ul className="mt-3.5 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link
                        to={link.to}
                        className="text-sm text-ink-secondary transition-colors hover:text-brown-dark"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-relaxed text-ink-muted">
            Soba is an emotional support companion and is not a substitute for professional mental
            health care. In an emergency, contact local emergency services.
          </p>
          <p className="text-xs text-ink-muted">© {new Date().getFullYear()} Soba</p>
        </div>
      </div>
    </footer>
  )
}
