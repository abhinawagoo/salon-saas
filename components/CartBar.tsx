'use client'

import { ShoppingBag } from 'lucide-react'
import { useCurrency } from '@/lib/CurrencyContext'

interface CartBarProps {
  itemCount: number
  totalPrice: number
  onContinue: () => void
}

export default function CartBar({ itemCount, totalPrice, onContinue }: CartBarProps) {
  const { formatPrice } = useCurrency()
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 bg-gray-900 rounded-full p-2.5 sm:p-3">
              <ShoppingBag className="text-white" size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} · {formatPrice(totalPrice)}
              </p>
              <p className="text-xs text-gray-500 sm:hidden">Tap to proceed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="flex-shrink-0 bg-gray-900 text-white px-5 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base hover:bg-gray-800 transition-all min-h-[44px] sm:min-h-[48px] shadow-lg touch-manipulation flex items-center justify-center"
          >
            Proceed to Book
          </button>
        </div>
      </div>
    </div>
  )
}
