'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { setUserRole } from '@/lib/auth'
import HomeLandingBanner from '@/components/HomeLandingBanner'
import HomeVideoCarousel from '@/components/HomeVideoCarousel'
import { SEO } from '@/lib/seo'
import { Calendar, Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface SiteSettings {
  brandName: string
  heroBannerImageUrl: string | null
  galleryImageUrls: string[]
}

interface HomeVideo {
  id: string
  videoUrl: string
  title?: string | null
  order: number
}

export default function HomeClient() {
  const [settings, setSettings] = useState<SiteSettings>({
    brandName: 'Valessio Paris',
    heroBannerImageUrl: null,
    galleryImageUrls: [],
  })
  const [videos, setVideos] = useState<HomeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    setUserRole('CUSTOMER')
    sessionStorage.removeItem('selectedServices')
    Promise.all([
      fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/home/videos').then((r) => r.json()),
    ])
      .then(([settingsData, videosData]) => {
        setSettings({
          brandName: settingsData.brandName ?? 'Valessio Paris',
          heroBannerImageUrl: settingsData.heroBannerImageUrl ?? null,
          galleryImageUrls: Array.isArray(settingsData.galleryImageUrls) ? settingsData.galleryImageUrls : [],
        })
        setVideos(Array.isArray(videosData) ? videosData : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const galleryImages = settings.galleryImageUrls
  const lbPrev = useCallback(() => setLightboxIndex(i => i === null ? null : (i - 1 + galleryImages.length) % galleryImages.length), [galleryImages.length])
  const lbNext = useCallback(() => setLightboxIndex(i => i === null ? null : (i + 1) % galleryImages.length), [galleryImages.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') lbPrev()
      else if (e.key === 'ArrowRight') lbNext()
      else if (e.key === 'Escape') setLightboxIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, lbPrev, lbNext])

  const heroMediaUrl = settings.heroBannerImageUrl ?? null
  const heroIsVideo = heroMediaUrl ? /\.mp4(\?|$)/i.test(heroMediaUrl) : false
  const bannerSlides = heroMediaUrl && !heroIsVideo
    ? [{ imageUrl: heroMediaUrl, alt: SEO.bannerAlt }]
    : []

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-charcoal-dark">
        <div className="text-center">
          <div className="font-serif text-white/20 text-2xl tracking-[0.3em] uppercase mb-4">Valessio</div>
          <div className="w-6 h-6 border border-gold/40 border-t-gold rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Hero */}
      <div className="relative h-[calc(100vh-64px)] overflow-hidden bg-charcoal-dark">
        {heroIsVideo && heroMediaUrl ? (
          <video
            src={heroMediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            loop
          />
        ) : bannerSlides.length > 0 ? (
          <div className="absolute inset-0">
            <HomeLandingBanner slides={bannerSlides} />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal-dark via-charcoal to-charcoal-light" />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10 pointer-events-none" />

        {/* Brand text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-white/40 text-[9px] sm:text-[10px] tracking-[0.5em] uppercase font-sans font-light mb-4">
            Luxury Beauty
          </p>
          <h1 className="font-serif text-white text-5xl sm:text-7xl md:text-8xl font-light tracking-[0.25em] uppercase leading-none">
            Valessio
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-px w-8 bg-gold/60" />
            <p className="text-gold text-[9px] sm:text-[11px] tracking-[0.6em] uppercase font-sans font-light">
              Paris
            </p>
            <div className="h-px w-8 bg-gold/60" />
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-10 sm:pb-12 gap-4">
          <Link
            href="/booking/location"
            className="flex items-center gap-2.5 bg-gold hover:bg-gold-dark active:scale-95 text-charcoal-dark text-xs sm:text-sm tracking-[0.2em] uppercase font-sans font-medium px-8 py-4 rounded-full shadow-lg shadow-black/30 transition-all"
          >
            <Calendar size={15} />
            Book Appointment
          </Link>
          <Link
            href="/services"
            className="text-white/50 hover:text-white/80 text-[10px] tracking-[0.3em] uppercase font-sans font-light transition-colors"
          >
            Explore Services
          </Link>
        </div>
      </div>

      {/* Our Work */}
      {videos.length > 0 && (
        <section className="bg-cream py-10 sm:py-14">
          {/* Title — stays centered */}
          <div className="flex items-center gap-3 justify-center mb-8 px-4 max-w-sm mx-auto">
            <div className="h-px flex-1 bg-charcoal-dark/10" />
            <Sparkles size={11} className="text-gold" />
            <p className="text-[10px] tracking-[0.4em] uppercase font-sans text-stone">Our Work</p>
            <Sparkles size={11} className="text-gold" />
            <div className="h-px flex-1 bg-charcoal-dark/10" />
          </div>
          {/* Slider — full viewport width so multiple cards show */}
          <div className="h-[440px] sm:h-[500px] lg:h-[540px]">
            <HomeVideoCarousel videos={videos} />
          </div>
        </section>
      )}

      {/* Gallery */}
      {settings.galleryImageUrls.length > 0 && (
        <section className="bg-white py-10 sm:py-14">
          <div className="flex items-center gap-3 justify-center mb-8 px-4 max-w-sm mx-auto">
            <div className="h-px flex-1 bg-charcoal-dark/10" />
            <Sparkles size={11} className="text-gold" />
            <p className="text-[10px] tracking-[0.4em] uppercase font-sans text-stone">Gallery</p>
            <Sparkles size={11} className="text-gold" />
            <div className="h-px flex-1 bg-charcoal-dark/10" />
          </div>
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {galleryImages.slice(0, 6).map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className="aspect-square rounded-xl overflow-hidden bg-stone/10 focus:outline-none"
                  onClick={() => setLightboxIndex(i)}
                >
                  <img
                    src={url}
                    alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            {galleryImages.length > 6 && (
              <div className="text-center mt-6">
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-2 border border-charcoal-dark/20 hover:border-charcoal-dark text-charcoal-dark text-[10px] tracking-[0.3em] uppercase font-sans font-light px-7 py-3.5 rounded-full transition-colors"
                >
                  View All Photos
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Services CTA */}
      <section className="bg-charcoal-dark py-10 sm:py-14 px-6">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-white/30 text-[9px] tracking-[0.5em] uppercase font-sans mb-3">Experience Luxury</p>
          <h2 className="font-serif text-white text-2xl sm:text-3xl font-light mb-6">
            Crafted for the Discerning
          </h2>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 border border-gold/40 hover:border-gold text-gold text-[10px] tracking-[0.3em] uppercase font-sans font-light px-7 py-3.5 rounded-full transition-colors"
          >
            View All Services
          </Link>
        </div>
      </section>

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-10 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={22} />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            {lightboxIndex + 1} / {galleryImages.length}
          </div>
          {galleryImages.length > 1 && (
            <button
              type="button"
              className="absolute left-3 sm:left-6 z-10 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); lbPrev() }}
            >
              <ChevronLeft size={28} />
            </button>
          )}
          <img
            src={galleryImages[lightboxIndex]}
            alt={`Gallery ${lightboxIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {galleryImages.length > 1 && (
            <button
              type="button"
              className="absolute right-3 sm:right-6 z-10 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              onClick={(e) => { e.stopPropagation(); lbNext() }}
            >
              <ChevronRight size={28} />
            </button>
          )}
        </div>
      )}
    </>
  )
}
