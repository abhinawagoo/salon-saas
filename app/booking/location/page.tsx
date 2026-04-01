'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ChevronRight } from 'lucide-react'

interface Location {
  id: string
  name: string
  slug: string
  address: string | null
  imageUrl?: string | null
}

export default function LocationPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('payment_completed') === '1') {
      sessionStorage.removeItem('payment_completed')
      router.replace('/')
      return
    }
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        setLocations(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [router])

  const handleSelect = (location: Location) => {
    sessionStorage.setItem('bookingLocation', JSON.stringify({ id: location.id, name: location.name, address: location.address }))
    router.push('/booking/date-time')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-dark flex items-center justify-center">
        <div className="text-center">
          <div className="font-serif text-white/20 text-xl tracking-[0.3em] uppercase mb-3">Valessio</div>
          <div className="w-5 h-5 border border-gold/40 border-t-gold rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-charcoal-dark px-6 py-8 sm:py-10">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-white/30 text-[9px] tracking-[0.5em] uppercase font-sans mb-2">Step 1</p>
          <h1 className="font-serif text-white text-2xl sm:text-3xl font-light tracking-wide">
            Choose Your Location
          </h1>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-px w-6 bg-gold/50" />
            <div className="w-1 h-1 rounded-full bg-gold/60" />
            <div className="h-px w-6 bg-gold/50" />
          </div>
        </div>
      </div>

      {/* Location cards */}
      <div className="max-w-xl mx-auto px-4 py-6 sm:py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {locations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone font-sans text-sm">No locations available. Please try again later.</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-4 text-gold text-xs tracking-widest uppercase font-sans underline underline-offset-4"
            >
              Back to home
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full bg-white rounded-2xl border border-ivory hover:border-gold/40 shadow-sm hover:shadow-md p-4 sm:p-5 text-left transition-all flex items-center gap-4 group"
              >
                <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-ivory flex items-center justify-center">
                  {loc.imageUrl ? (
                    <img src={loc.imageUrl} alt={loc.name} className="w-full h-full object-cover" />
                  ) : (
                    <MapPin size={20} className="text-gold" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-charcoal-dark text-lg font-light">{loc.name}</p>
                  {loc.address && (
                    <p className="text-stone text-xs mt-0.5 font-sans truncate">{loc.address}</p>
                  )}
                </div>
                <ChevronRight size={18} className="text-gold/50 group-hover:text-gold flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
