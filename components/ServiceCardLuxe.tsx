'use client'

import { useState } from 'react'
import { Check, Clock, Share2 } from 'lucide-react'
import { PLACEHOLDER_IMAGE } from '@/lib/placeholders'
import { useCurrency } from '@/lib/CurrencyContext'

interface ServiceCardLuxeProps {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  duration: number
  onAdd: () => void
  onViewDetails: () => void
  isSelected?: boolean
  onRemove?: () => void
}

export default function ServiceCardLuxe({
  name,
  description,
  price,
  imageUrl,
  duration,
  onAdd,
  onViewDetails,
  isSelected = false,
  onRemove,
}: ServiceCardLuxeProps) {
  const { formatPrice } = useCurrency()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: description || `${name} - ${formatPrice(price)}`,
          url: window.location.href,
        })
      } catch {
        navigator.clipboard?.writeText(window.location.href)
      }
    } else {
      navigator.clipboard?.writeText(window.location.href)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Top banner section with image and overlay */}
      <div className="relative h-36 sm:h-40 bg-gradient-to-br from-sky-100 to-sky-200 overflow-hidden">
        {imageUrl && !error ? (
          <>
            <img
              src={PLACEHOLDER_IMAGE}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
            />
            <img
              src={imageUrl}
              alt={name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          </>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
        {/* Duration badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 rounded-lg text-gray-700 text-xs font-medium">
          <Clock size={14} />
          {duration >= 60 ? `${Math.floor(duration / 60)} hr ${duration % 60 ? `${duration % 60} mins` : ''}` : `${duration} mins`}
        </div>
      </div>

      {/* Service info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">{name}</h3>
          {isSelected ? (
            onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="shrink-0 px-3 py-1.5 rounded-lg border-2 border-red-200 text-red-600 font-medium text-sm hover:bg-red-50 transition-colors touch-manipulation"
              >
                Added
              </button>
            ) : (
              <span className="shrink-0 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-medium text-sm">
                Added
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="shrink-0 px-3 py-1.5 rounded-lg border-2 border-red-500 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors touch-manipulation"
            >
              ADD
            </button>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{description}</p>
        )}
        <p className="text-lg font-bold text-gray-900 mb-4">{formatPrice(price)}</p>

        {/* Bottom actions */}
        <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-200">
          <button
            type="button"
            onClick={onViewDetails}
            className="text-red-600 font-semibold text-sm hover:underline"
          >
            VIEW DETAILS
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Share"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
