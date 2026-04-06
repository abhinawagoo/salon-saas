'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const GAP      = 12   // px between cards
const LEAD_PAD = 20   // px left indent before first card

interface HomeVideo {
  id: string
  videoUrl: string
  title?: string | null
  order: number
}

export default function HomeVideoCarousel({ videos }: { videos: HomeVideo[] }) {
  const total = videos.length

  // ── Clone strip for infinite loop ─────────────────────────────────────────
  // Layout: [ clone-of-last | v0 | v1 | ... | v(n-1) | clone-of-first ]
  // Real slides live at indices 1 … total in the cloned array.
  const cloned = total > 1
    ? [videos[total - 1], ...videos, videos[0]]
    : videos

  // cloneIdx: position in cloned array. Starts at 1 (first real slide).
  const [cloneIdx, setCloneIdx]   = useState(total > 1 ? 1 : 0)
  const [animated, setAnimated]   = useState(true)   // false during silent teleport
  const [dragX, setDragX]         = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [cardW, setCardW]         = useState(0)

  const startXRef  = useRef(0)
  const startMsRef = useRef(0)
  const wasDragRef = useRef(false)
  const videoRefs  = useRef<(HTMLVideoElement | null)[]>([])
  const wrapRef    = useRef<HTMLDivElement>(null)

  const stepPx  = cardW + GAP
  // Dot index = which real video is active
  const dotIdx  = total > 1 ? ((cloneIdx - 1 + total) % total) : 0

  // ── Card width = container height × 9/16 ──────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setCardW(Math.round(wrapRef.current.offsetHeight * 9 / 16))
    }
    update()
    const ro = new ResizeObserver(update)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Play active video, pause others ──────────────────────────────────────
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === cloneIdx) v.play().catch(() => {})
      else { v.pause(); v.currentTime = 0 }
    })
  }, [cloneIdx])

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => { setAnimated(true); setCloneIdx(i => i + 1) }, [])
  const goPrev = useCallback(() => { setAnimated(true); setCloneIdx(i => i - 1) }, [])

  // After strip transition ends: silently teleport from clone to real slide
  const onTransitionEnd = useCallback(() => {
    if (total <= 1) return
    if (cloneIdx === 0) {
      // Landed on left clone (= last real slide) → jump to index `total`
      setAnimated(false)
      setCloneIdx(total)
    } else if (cloneIdx === cloned.length - 1) {
      // Landed on right clone (= first real slide) → jump to index 1
      setAnimated(false)
      setCloneIdx(1)
    }
  }, [cloneIdx, total, cloned.length])

  // Re-enable animation on the frame after the silent teleport
  useEffect(() => {
    if (!animated) {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnimated(true))
      )
      return () => cancelAnimationFrame(id)
    }
  }, [animated])

  // ── Pointer drag (touch + mouse) ──────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (total <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startXRef.current  = e.clientX
    startMsRef.current = Date.now()
    wasDragRef.current = false
    setDragging(true)
    setDragX(0)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    const raw = e.clientX - startXRef.current
    if (Math.abs(raw) > 6) wasDragRef.current = true
    setDragX(raw)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)

    if (!wasDragRef.current) {
      // Tap: right half → next, left half → prev
      const rect = e.currentTarget.getBoundingClientRect()
      if (e.clientX - rect.left > rect.width / 2) goNext()
      else goPrev()
      setDragX(0)
      return
    }

    const elapsed  = Math.max(Date.now() - startMsRef.current, 1)
    const velocity = dragX / elapsed   // px/ms
    const byDist   = Math.abs(dragX) > stepPx * 0.3
    const byFlick  = Math.abs(velocity) > 0.3

    if      (dragX < 0 && (byDist || byFlick)) goNext()
    else if (dragX > 0 && (byDist || byFlick)) goPrev()

    setDragX(0)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (total === 0) return null

  const translatePx = LEAD_PAD - cloneIdx * stepPx + dragX
  const spring      = 'cubic-bezier(0.25,1,0.5,1)'
  const noTransition = dragging || !animated

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Strip */}
      <div
        className="flex h-full items-center"
        style={{
          gap:        GAP,
          transform:  `translateX(${translatePx}px)`,
          transition: noTransition ? 'none' : `transform 420ms ${spring}`,
          willChange: 'transform',
        }}
        onTransitionEnd={onTransitionEnd}
      >
        {cloned.map((v, i) => {
          const isActive = i === cloneIdx
          return (
            <div
              key={`${v.id}-${i}`}
              className="flex-shrink-0 h-full rounded-2xl overflow-hidden bg-charcoal-dark"
              style={{
                width:       cardW > 0 ? cardW : undefined,
                aspectRatio: cardW === 0 ? '9/16' : undefined,
                opacity:     isActive ? 1 : 0.55,
                transform:   isActive ? 'scale(1)' : 'scale(0.94)',
                transition:  noTransition ? 'none' : `opacity 420ms ease, transform 420ms ${spring}`,
              }}
            >
              <video
                ref={el => { videoRefs.current[i] = el }}
                src={v.videoUrl}
                className="w-full h-full object-cover pointer-events-none"
                muted
                playsInline
                onEnded={goNext}
                preload={i <= 2 ? 'auto' : 'metadata'}
                draggable={false}
              />
            </div>
          )
        })}
      </div>

      {/* Dots — reflect real video index */}
      {total > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-none">
          {videos.map((_, i) => (
            <span
              key={i}
              className={`block h-px transition-all duration-300 ${
                i === dotIdx ? 'bg-gold w-6' : 'bg-white/30 w-3'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
