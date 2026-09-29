import { SobaBear } from '../ui/SobaBear'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Logo } from '../ui/Brand'
import { ButtonLink } from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { homeRouteFor } from '../../context/AuthContext'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 ease-soba',
        scrolled
          ? 'border-b border-line/70 bg-background/80 shadow-[0_1px_20px_rgba(82,58,40,0.05)] backdrop-blur-xl backdrop-saturate-150'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav
        className="container-soba flex h-[72px] items-center justify-between gap-3"
        aria-label="Main"
      >
        <Logo wordmarkClassName="max-[389px]:hidden" />

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {user ? (
            <ButtonLink to={homeRouteFor(user.role)} size="sm" className="group">
              Open Soba
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log In
              </ButtonLink>
              <ButtonLink to="/signup" size="sm" className="group">
                Get Started
                <ArrowRight
                  className="hidden h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
                  aria-hidden="true"
                />
              </ButtonLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

const footerLinks = [
  { href: '#about', label: 'About' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#safety', label: 'Safety' },
  { href: '#support', label: 'Support' },
]

export function Footer() {
  return (
    <footer className="grain relative border-t border-line bg-gradient-to-b from-cream/70 to-cream/40">
      <div className="container-soba py-12 lg:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-4">
              <Logo to="" />
              <SobaBear pose="walking" className="w-12" />
            </div>
            <p className="mt-3 text-sm font-medium text-brown">Listen. Support. Connect.</p>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  to={{ pathname: '/', hash: link.href }}
                  className="text-sm text-ink-secondary transition-colors hover:text-brown-dark"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
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
