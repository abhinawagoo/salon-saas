'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Instagram, Facebook } from 'lucide-react'

interface SiteSettings {
  facebookUrl?: string | null
  instagramUrl?: string | null
}

export default function Footer() {
  const pathname = usePathname()
  const [settings, setSettings] = useState<SiteSettings>({})

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => {})
  }, [])

  if (pathname?.startsWith('/booking') || pathname?.startsWith('/login')) return null

  return (
    <footer className="bg-charcoal-dark border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="font-serif text-white text-2xl sm:text-3xl font-light tracking-[0.35em] uppercase leading-none">
            Valessio
          </div>
          <div className="text-gold text-[9px] tracking-[0.55em] uppercase font-sans font-light mt-1">
            Paris
          </div>
          <p className="text-white/30 text-xs tracking-widest uppercase font-sans font-light mt-4">
            Luxury Beauty Experience
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-white/10" />
          <div className="w-1 h-1 rounded-full bg-gold/50" />
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-10">
          {[
            { href: '/services', label: 'Services' },
            { href: '/gallery', label: 'Gallery' },
            { href: '/contact', label: 'Contact' },
            { href: '/booking/location', label: 'Book Now' },
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms', label: 'Terms' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-white/40 hover:text-white/80 text-[10px] tracking-[0.25em] uppercase font-sans font-light transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Social */}
        {(settings.instagramUrl || settings.facebookUrl) && (
          <div className="flex justify-center gap-4 mb-10">
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-gold hover:border-gold/40 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={16} />
              </a>
            )}
            {settings.facebookUrl && (
              <a
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-gold hover:border-gold/40 transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={16} />
              </a>
            )}
          </div>
        )}

        {/* Copyright */}
        <p className="text-center text-white/20 text-[10px] tracking-widest uppercase font-sans">
          © {new Date().getFullYear()} Valessio Paris. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
