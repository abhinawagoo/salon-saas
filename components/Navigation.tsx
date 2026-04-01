'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, User, LogOut, Calendar, ChevronDown } from 'lucide-react'
import { getUserRole, AUTH_DISABLED_FOR_NOW } from '@/lib/auth'

export default function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [user, setUser] = useState<{ name: string; mobile: string } | null>(null)
  const [role, setRole] = useState<string>('CUSTOMER')
  const pathname = usePathname()

  const authDisabled = AUTH_DISABLED_FOR_NOW || process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
    setRole(getUserRole())
  }, [pathname])

  useEffect(() => {
    if (authDisabled) return
    fetch('/api/user/me')
      .then((r) => r.json())
      .then((data) => setUser(data?.user || null))
      .catch(() => {})
  }, [authDisabled, pathname])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  const isAdminOrStaff = role === 'ADMIN' || role === 'STAFF'

  if (pathname?.startsWith('/booking') || pathname?.startsWith('/login')) return null

  return (
    <nav className="sticky top-0 z-50 bg-charcoal-dark border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative flex items-center justify-between h-16">

          {/* Left */}
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden text-white/70 hover:text-white p-1 -ml-1 transition-colors"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div className="hidden sm:flex items-center gap-7">
              <Link href="/services" className="text-white/60 hover:text-white text-[10px] tracking-[0.25em] uppercase font-sans font-light transition-colors">
                Services
              </Link>
              <Link href="/gallery" className="text-white/60 hover:text-white text-[10px] tracking-[0.25em] uppercase font-sans font-light transition-colors">
                Gallery
              </Link>
              <Link href="/contact" className="text-white/60 hover:text-white text-[10px] tracking-[0.25em] uppercase font-sans font-light transition-colors">
                Contact
              </Link>
              {isAdminOrStaff && (
                <Link
                  href={role === 'ADMIN' ? '/admin' : '/staff'}
                  className="text-gold/70 hover:text-gold text-[10px] tracking-[0.25em] uppercase font-sans font-light transition-colors"
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Center brand */}
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-center select-none">
            <div className="font-serif text-white text-[22px] sm:text-[26px] font-light tracking-[0.3em] uppercase leading-none">
              Valessio
            </div>
            <div className="text-gold text-[8px] sm:text-[9px] tracking-[0.5em] uppercase font-sans font-light mt-0.5">
              Paris
            </div>
          </Link>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/booking/location"
              className="hidden sm:flex items-center gap-2 bg-gold hover:bg-gold-dark text-charcoal-dark text-[10px] tracking-[0.2em] uppercase font-sans font-medium px-5 py-2.5 rounded-full transition-colors"
            >
              <Calendar size={12} />
              Book
            </Link>
            <Link
              href="/booking/location"
              className="sm:hidden flex items-center justify-center w-9 h-9 bg-gold hover:bg-gold-dark text-charcoal-dark rounded-full transition-colors"
              aria-label="Book appointment"
            >
              <Calendar size={16} />
            </Link>

            {!authDisabled && user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
                  aria-label="Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-gold/30 flex items-center justify-center">
                    <User size={14} className="text-gold" />
                  </div>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-charcoal border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white text-sm font-medium truncate">{user.name || 'Guest'}</p>
                      <p className="text-white/40 text-xs mt-0.5 font-sans">{user.mobile}</p>
                    </div>
                    <Link
                      href="/profile/bookings"
                      className="flex items-center gap-2.5 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 text-sm font-sans transition-colors"
                    >
                      <Calendar size={14} />
                      My Bookings
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 text-sm font-sans transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="sm:hidden bg-charcoal-dark border-t border-white/5">
          <div className="px-6 py-1">
            {[
              { href: '/services', label: 'Services' },
              { href: '/gallery', label: 'Gallery' },
              { href: '/contact', label: 'Contact' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center py-3.5 text-white/60 hover:text-white text-[10px] tracking-[0.3em] uppercase font-sans font-light border-b border-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            {isAdminOrStaff && (
              <Link
                href={role === 'ADMIN' ? '/admin' : '/staff'}
                className="flex items-center py-3.5 text-gold/70 hover:text-gold text-[10px] tracking-[0.3em] uppercase font-sans font-light transition-colors"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
