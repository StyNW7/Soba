import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Footer, Navbar } from '../components/landing/Navbar'

export function PublicLayout() {
  const { pathname, hash, key } = useLocation()
  const previousPath = useRef<string | null>(null)

  // The public site is one page, so section links arrive as `/#section`.
  // Glide when already on the page; jump when arriving from another URL.
  useEffect(() => {
    const samePage = previousPath.current === pathname
    previousPath.current = pathname
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null
    if (target) target.scrollIntoView({ behavior: samePage ? 'smooth' : 'instant', block: 'start' })
    else if (!samePage) window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash, key])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brown focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-cream"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
