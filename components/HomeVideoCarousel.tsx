'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

interface HomeVideo {
  id: string
  videoUrl: string
  title?: string | null
  order: number
}

interface HomeVideoCarouselProps {
  videos: HomeVideo[]
}

export default function HomeVideoCarousel({ videos }: HomeVideoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const justSwipedRef = useRef(false)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  const goPrev = useCallback(() => setActiveIndex((i) => (i - 1 + videos.length) % videos.length), [videos.length])
  const goNext = useCallback(() => setActiveIndex((i) => (i + 1) % videos.length), [videos.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    justSwipedRef.current = false
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || videos.length <= 1) return
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
    if (videos.length > 1) goNext()
  }

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, videos.length)
  }, [videos.length])

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (v) {
        if (i === activeIndex) {
          v.play().catch(() => {})
        } else {
          v.pause()
          v.currentTime = 0
        }
      }
    })
  }, [activeIndex])

  if (videos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ivory rounded-2xl">
        <p className="text-stone text-xs tracking-widest uppercase font-sans">No videos yet</p>
      </div>
    )
  }

  return (
    <div
      className="relative w-full h-full bg-charcoal-dark rounded-2xl overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className="w-full h-full cursor-pointer"
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {videos.map((v, i) => (
            <div key={v.id} className="min-w-full flex-shrink-0 h-full flex items-center justify-center">
              <video
                ref={(el) => { videoRefs.current[i] = el }}
                src={v.videoUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
                onEnded={goNext}
                preload={i === 0 ? 'auto' : 'metadata'}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Gold line dots */}
      {videos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {videos.map((_, i) => (
            <span
              key={i}
              className={`block h-px transition-all duration-300 ${
                i === activeIndex ? 'bg-gold w-6' : 'bg-white/30 w-3'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
