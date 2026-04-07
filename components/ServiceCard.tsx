'use client'

import { useState } from 'react'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { PLACEHOLDER_IMAGE } from '@/lib/placeholders'
import { useCurrency } from '@/lib/CurrencyContext'

interface ServiceCardProps {
  id: string
  name: string
  description?: string
  price: number
  imageUrl?: string
  duration: number
  onAdd: () => void
  /** Called when user clicks the card (image/name/description) to view details. Opens modal. */
  onCardClick?: () => void
  /** Quantity in cart. 0 = show Add button, >0 = show +/- counter */
  quantity?: number
  onIncrease?: () => void
  onDecrease?: () => void
  /** Remove item completely (all quantity) */
  onDelete?: () => void
}

export default function ServiceCard({ name, description, price, imageUrl, duration, onAdd, onCardClick, quantity = 0, onIncrease, onDecrease, onDelete }: ServiceCardProps) {
  const { formatPrice } = useCurrency()
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const hasQuantity = quantity > 0

  const handleCardClick = onCardClick ?? onAdd

  return (
    <div className={`bg-white rounded-xl sm:rounded-2xl border overflow-hidden transition-all duration-200 group flex flex-col h-full min-h-[280px] sm:min-h-[320px] ${
      hasQuantity ? 'border-primary-300 bg-primary-50/30 ring-1 ring-primary-200' : 'border-gray-200 hover:border-primary-300 hover:shadow-lg'
    }`}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick() } }}
        className="flex flex-col flex-1 min-h-0 shrink-0 cursor-pointer"
      >
        <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden shrink-0">
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
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-300 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
            <span className="text-primary-500 text-2xl sm:text-3xl font-light">{name.charAt(0)}</span>
          </div>
        )}
        </div>
        <div className="p-3 sm:p-4 flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          <h3 className="font-semibold text-sm sm:text-lg text-gray-900 mb-0.5 sm:mb-1 line-clamp-2">{name}</h3>
          {description ? (
            <p className="text-xs sm:text-sm text-gray-500 line-clamp-3">{description}</p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-400 italic line-clamp-2">No description</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{duration} min</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 pt-3 border-t border-gray-100 shrink-0">
          <span className="text-base sm:text-2xl font-semibold sm:font-light text-gray-900">{formatPrice(price)}</span>
          {hasQuantity ? (
            <div className="flex items-center gap-1">
              <div className="flex items-center justify-center gap-0 rounded-full border-2 border-primary-400 min-h-[40px] sm:min-h-[44px] overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDecrease?.() }}
                  className="flex items-center justify-center w-10 sm:w-12 h-full text-primary-600 hover:bg-primary-50 transition-colors touch-manipulation"
                  aria-label="Decrease quantity"
                >
                  <Minus size={18} />
                </button>
                <span className="flex items-center justify-center min-w-[2rem] sm:min-w-[2.5rem] px-2 font-semibold text-primary-700 text-sm sm:text-base">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onIncrease?.() }}
                  className="flex items-center justify-center w-10 sm:w-12 h-full text-primary-600 hover:bg-primary-50 transition-colors touch-manipulation"
                  aria-label="Increase quantity"
                >
                  <Plus size={18} />
                </button>
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete() }}
                  className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-red-500 hover:bg-red-50 transition-colors touch-manipulation shrink-0"
                  aria-label="Remove all"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="bg-gray-900 sm:bg-primary-600 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg hover:bg-gray-800 sm:hover:bg-primary-700 transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm min-h-[40px] sm:min-h-[44px] shadow-sm hover:shadow-md touch-manipulation"
            >
              <Plus size={14} className="sm:w-[18px] sm:h-[18px]" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
