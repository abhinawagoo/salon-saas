'use client'

import { CreditCard, Wallet, Shield, Plus, Minus, Trash2, Store } from 'lucide-react'
import { useState } from 'react'
import { useCurrency } from '@/lib/CurrencyContext'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  quantity?: number
}

export type PaymentType = 'FULL' | 'ADVANCE' | 'FREE'

export interface ResolvedPaymentOption {
  type: PaymentType
  label: string
  amount: number       // calculated amount to charge now
  description: string  // e.g. "Pay 20% now · ₹800 at salon"
}

interface PaymentScreenProps {
  services: Service[]
  totalAmount: number
  /** Called when the user confirms. For FREE, amount = 0; for FULL/ADVANCE, initiates gateway. */
  onPaymentInitiate: (paymentType: PaymentType, paymentMethod?: string) => void
  /** When provided, allow editing quantity. */
  onServicesChange?: (services: Service[]) => void
  totalBump?: boolean
  disabled?: boolean
  /** Controlled selected type from parent */
  selectedPaymentType?: PaymentType | null
  /** Called when user selects an option (before confirming). Parent shows arrival popup. */
  onPaymentTypeSelect?: (paymentType: PaymentType) => void
  /** Dynamic options from admin config. If omitted, falls back to hardcoded FULL + ADVANCE(30%). */
  paymentOptions?: ResolvedPaymentOption[]
}

const OPTION_ICONS: Record<PaymentType, typeof CreditCard> = {
  FULL: CreditCard,
  ADVANCE: Wallet,
  FREE: Store,
}

export default function PaymentScreen({
  services,
  totalAmount,
  onPaymentInitiate,
  onServicesChange,
  totalBump = false,
  disabled = false,
  selectedPaymentType: controlledType,
  onPaymentTypeSelect,
  paymentOptions,
}: PaymentScreenProps) {
  const { formatPrice } = useCurrency()
  const [internalType, setInternalType] = useState<PaymentType | null>(null)
  const selectedPaymentType = controlledType ?? internalType

  // Build options: prefer dynamic config, fall back to hardcoded
  const options: ResolvedPaymentOption[] = paymentOptions && paymentOptions.length > 0
    ? paymentOptions
    : [
        { type: 'FULL', label: 'Pay Full Amount', amount: totalAmount, description: formatPrice(totalAmount) },
        {
          type: 'ADVANCE',
          label: 'Pay Advance',
          amount: Math.round(totalAmount * 0.3),
          description: `${formatPrice(Math.round(totalAmount * 0.3))} (30%) · Pay remaining at salon`,
        },
      ]

  // Auto-select if only one option
  const effectiveSelected = selectedPaymentType ?? (options.length === 1 ? options[0].type : null)

  const handleOptionClick = (type: PaymentType) => {
    if (disabled) return
    if (onPaymentTypeSelect) {
      onPaymentTypeSelect(type)
    } else {
      setInternalType(type)
    }
  }

  const selectedOption = options.find((o) => o.type === effectiveSelected)
  const isFree = effectiveSelected === 'FREE'

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Booking Summary */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Booking Summary</h3>
        <div className="space-y-2 sm:space-y-3">
          {services.map((service) => {
            const qty = service.quantity ?? 1
            const lineTotal = service.price * qty
            const canEdit = !!onServicesChange
            return (
              <div
                key={service.id}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto] items-center py-2 border-b border-gray-100 gap-2 sm:gap-3"
              >
                <div className="min-w-0 overflow-hidden">
                  <p className="font-medium text-sm text-gray-900 break-words">{service.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {service.duration} min{qty > 1 ? ` · ×${qty}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 justify-self-end">
                  {canEdit && qty > 0 ? (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            if (qty <= 1) return
                            const updated = services
                              .map((s) => (s.id === service.id ? { ...s, quantity: (s.quantity ?? 1) - 1 } : s))
                              .filter((s) => (s.quantity ?? 1) > 0)
                            onServicesChange!(updated)
                          }}
                          className="flex items-center justify-center w-8 h-8 text-gray-600 hover:bg-gray-50"
                          aria-label="Decrease"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-medium">{qty}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = services.map((s) =>
                              s.id === service.id ? { ...s, quantity: (s.quantity ?? 1) + 1 } : s
                            )
                            onServicesChange!(updated)
                          }}
                          className="flex items-center justify-center w-8 h-8 text-gray-600 hover:bg-gray-50"
                          aria-label="Increase"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onServicesChange!(services.filter((s) => s.id !== service.id))}
                        className="flex items-center justify-center w-7 h-7 rounded text-red-500 hover:bg-red-50"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-gray-900 shrink-0 justify-self-end">
                  {formatPrice(lineTotal)}
                </p>
              </div>
            )
          })}
          <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
            <p className="text-sm sm:text-base font-semibold text-gray-900">Total</p>
            <p
              className={`text-base sm:text-xl font-semibold transition-all duration-200 ${
                totalBump ? 'scale-105 text-green-600' : 'scale-100 text-gray-900'
              }`}
            >
              {formatPrice(totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Options */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
          {options.length === 1 ? 'Payment' : 'Choose Payment Option'}
        </h3>
        <div className="space-y-2 sm:space-y-3">
          {options.map((opt) => {
            const Icon = OPTION_ICONS[opt.type]
            const isSelected = effectiveSelected === opt.type
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleOptionClick(opt.type)}
                disabled={disabled || options.length === 1}
                className={`w-full p-3 sm:p-5 border-2 rounded-xl transition-all duration-200 text-left min-h-[64px] sm:min-h-[80px] touch-manipulation ${
                  disabled ? 'opacity-60 cursor-not-allowed' : options.length === 1 ? 'cursor-default' : ''
                } ${
                  isSelected ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`rounded-full p-2.5 sm:p-4 shrink-0 ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                    <Icon className={isSelected ? 'text-white' : 'text-gray-600'} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm sm:text-base font-light ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {opt.label}
                    </p>
                    <p className={`text-xs sm:text-sm font-light mt-0.5 ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                      {opt.type === 'FREE' ? 'No payment required now' : formatPrice(opt.amount)}
                    </p>
                    {opt.description && opt.type !== 'FULL' && (
                      <p className={`text-xs mt-0.5 font-light ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                        {opt.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Confirm / Pay button */}
      {effectiveSelected && selectedOption && (
        <>
          {/* Payment method (only for gateway payments) */}
          {!isFree && (
            <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-6 shadow-sm">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2">
                <Shield size={18} />
                Payment Method
              </h3>
              <div className="p-3 sm:p-4 border-2 border-gray-200 rounded-xl">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="text-xl sm:text-2xl">📱</div>
                  <div>
                    <p className="font-light text-sm sm:text-base text-gray-900">PhonePe</p>
                    <p className="text-xs sm:text-sm text-gray-500 font-light">UPI, Cards, Wallets</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-6 shadow-sm">
            <button
              type="button"
              onClick={() => !disabled && onPaymentInitiate(effectiveSelected)}
              disabled={disabled}
              className={`w-full bg-black text-white py-3 rounded-full font-semibold text-base hover:bg-gray-800 transition-all duration-200 shadow-lg min-h-[48px] touch-manipulation ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isFree
                ? 'Confirm Booking'
                : `Pay ${formatPrice(selectedOption.amount)} Now`}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3 sm:mt-4 font-light">
              {isFree
                ? 'Your slot will be reserved immediately'
                : 'Click to proceed with secure payment'}
            </p>
          </div>
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <Shield className="text-blue-600 mt-0.5 shrink-0" size={20} />
          <p className="text-sm text-blue-900 font-light">
            <strong className="font-medium">Secure Booking:</strong> Your appointment is confirmed
            instantly.{' '}
            {isFree
              ? 'Pay the full amount when you arrive at the salon.'
              : 'Payment is processed securely through PhonePe. We never store your card or UPI details.'}
          </p>
        </div>
      </div>
    </div>
  )
}
