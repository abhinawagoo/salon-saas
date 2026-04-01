'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const AUTO_ADVANCE_MS = 5000
const SWIPE_THRESHOLD = 50

interface HomeLandingBannerProps {
  slides: { imageUrl: string; alt?: string }[]
  onNext?: () => void
}

export default function HomeLandingBanner({ slides, onNext }: HomeLandingBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const justSwipedRef = useRef(false)

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % slides.length)
    onNext?.()
  }, [slides.length, onNext])

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(goNext, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [slides.length, goNext])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    justSwipedRef.current = false
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || slides.length <= 1) return
    const diff = touchStart - e.changedTouches[0].clientX
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      justSwipedRef.current = true
      if (diff > 0) goNext()
      else goPrev()
    }
    setTouchStart(null)
  }

  const handleClick = () => {
    if (justSwipedRef.current) return
    goNext()
  }

  if (slides.length === 0) {
    return <div className="w-full h-full bg-gradient-to-br from-charcoal-dark to-charcoal" />
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className="flex h-full cursor-pointer transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={i} className="min-w-full flex-shrink-0 h-full relative">
            <img
              src={slide.imageUrl}
              alt={slide.alt || 'Valessio Paris'}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </div>
        ))}
      </div>

      {/* Line dots — gold style */}
      {slides.length > 1 && (
        <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`block h-px transition-all duration-300 ${
                i === activeIndex ? 'bg-gold w-6' : 'bg-white/40 w-3'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
