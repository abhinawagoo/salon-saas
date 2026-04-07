'use client'

import { X, Plus, Minus, Trash2 } from 'lucide-react'
import { useCurrency } from '@/lib/CurrencyContext'

interface ServiceModalProps {
  service: {
    id: string
    name: string
    description?: string
    price: number
    duration: number
    imageUrl?: string
  }
  isOpen: boolean
  onClose: () => void
  onAdd: () => void
  /** Quantity in cart. 0 = show Add button, >0 = show +/- counter */
  quantity?: number
  onIncrease?: () => void
  onDecrease?: () => void
  /** Remove item completely (all quantity) */
  onDelete?: () => void
}

/** Parse description into paragraphs and list items (steps). */
function parseDescription(description: string): { type: 'paragraph' | 'list'; content: string | string[] }[] {
  const lines = description.split('\n').map((l) => l.trim()).filter(Boolean)
  const result: { type: 'paragraph' | 'list'; content: string | string[] }[] = []
  let listBuffer: string[] = []
  let paragraphBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length > 0) {
      result.push({ type: 'list', content: listBuffer })
      listBuffer = []
    }
  }

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      result.push({ type: 'paragraph', content: paragraphBuffer.join(' ') })
      paragraphBuffer = []
    }
  }

  const isListLine = (line: string) =>
    /^\d+[.)]\s/.test(line) ||
    /^[-•*]\s/.test(line) ||
    /^Step\s+\d+/i.test(line)

  for (const line of lines) {
    if (isListLine(line)) {
      flushParagraph()
      listBuffer.push(line.replace(/^[\d.)\-\•*]+\s*|^Step\s+\d+[.:]?\s*/i, '').trim() || line)
    } else {
      flushList()
      paragraphBuffer.push(line)
    }
  }
  flushList()
  flushParagraph()

  return result
}

export default function ServiceModal({ service, isOpen, onClose, onAdd, quantity = 0, onIncrease, onDecrease, onDelete }: ServiceModalProps) {
  const { formatPrice } = useCurrency()
  if (!isOpen) return null

  const hasQuantity = quantity > 0
  const parsed = service.description ? parseDescription(service.description) : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full image */}
        <div className="relative aspect-[4/3] w-full bg-gray-100 shrink-0">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
              <span className="text-primary-600 text-4xl font-bold">{service.name.charAt(0)}</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-full p-2 shadow-md hover:bg-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="p-5 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-3">{service.name}</h2>

            {parsed.length > 0 ? (
              <div className="space-y-4 text-gray-600 text-sm sm:text-base">
                {parsed.map((block, i) =>
                  block.type === 'paragraph' ? (
                    <p key={i} className="leading-relaxed">
                      {block.content}
                    </p>
                  ) : (
                    <div key={i}>
                      <p className="text-gray-500 font-medium mb-2 text-xs uppercase tracking-wide">Process</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
                        {(block.content as string[]).map((item, j) => (
                          <li key={j} className="pl-1">
                            {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )
                )}
              </div>
            ) : service.description ? (
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {service.description}
              </p>
            ) : null}
          </div>
        </div>

        {/* Fixed: pricing & timing - always visible */}
        <div className="px-5 sm:px-6 py-4 border-t border-gray-100 shrink-0 flex items-center gap-6">
          <div>
            <span className="text-xs text-gray-500 block">Duration</span>
            <span className="font-semibold text-gray-900">{service.duration} min</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Price</span>
            <span className="font-semibold text-primary-600 text-lg">{formatPrice(service.price)}</span>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 shrink-0">
          {hasQuantity ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-0 rounded-full border-2 border-primary-500 min-h-[48px] overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={onDecrease}
                  className="flex items-center justify-center h-full text-primary-600 hover:bg-primary-50 transition-colors touch-manipulation min-w-[48px]"
                  aria-label="Decrease quantity"
                >
                  <Minus size={22} />
                </button>
                <span className="flex items-center justify-center min-w-[3rem] font-semibold text-primary-700 text-lg">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={onIncrease}
                  className="flex items-center justify-center h-full text-primary-600 hover:bg-primary-50 transition-colors touch-manipulation min-w-[48px]"
                  aria-label="Increase quantity"
                >
                  <Plus size={22} />
                </button>
              </div>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center justify-center w-10 h-10 rounded-lg text-red-500 hover:bg-red-50 transition-colors touch-manipulation shrink-0"
                  aria-label="Remove all"
                  title="Remove"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold hover:bg-primary-700 transition-colors min-h-[48px] shadow-sm"
            >
              Add to Booking
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
