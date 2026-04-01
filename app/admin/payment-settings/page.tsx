'use client'

import { useState, useEffect } from 'react'
import { CreditCard, Wallet, Store, Save, ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react'
import { setUserRole } from '@/lib/auth'
import type { PaymentConfig, PaymentOptionConfig, AdvanceOption } from '@/lib/paymentConfig'
import { validatePaymentConfig } from '@/lib/paymentConfig'

const OPTION_META = {
  FULL: {
    icon: CreditCard,
    iconColor: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
    description: 'Customer pays 100% of the service amount through the payment gateway before the appointment is confirmed.',
  },
  ADVANCE: {
    icon: Wallet,
    iconColor: 'text-gold',
    bgColor: 'bg-gold/10',
    borderColor: 'border-gold/20',
    description: 'Customer pays a partial amount now to hold the slot. Remaining balance is collected at the salon.',
  },
  FREE: {
    icon: Store,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
    description: 'No payment required to book. Customer pays the full amount when they arrive at the salon.',
  },
}

export default function PaymentSettingsPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setUserRole('ADMIN')
  }, [])

  useEffect(() => {
    fetch('/api/admin/payment-config')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        const d = data as PaymentConfig
        if (d && Array.isArray(d.options) && d.options.length > 0) {
          setConfig(d)
        } else {
          setError('Invalid configuration from server')
        }
      })
      .catch(() => setError('Failed to load configuration'))
      .finally(() => setLoading(false))
  }, [])

  const updateOption = (index: number, updates: Partial<PaymentOptionConfig>) => {
    if (!config) return
    const options = config.options.map((opt, i) =>
      i === index ? { ...opt, ...updates } : opt
    ) as PaymentOptionConfig[]
    setConfig({ options })
    setError('')
    setSuccess(false)
  }

  const handleSave = async () => {
    if (!config) return
    const validationError = validatePaymentConfig(config)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch('/api/admin/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-dark flex items-center justify-center text-white/30">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading...
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-charcoal-dark flex items-center justify-center text-red-400 text-sm font-sans">
        {error || 'Failed to load configuration'}
      </div>
    )
  }

  const enabledCount = (config.options ?? []).filter((o) => o.enabled).length

  return (
    <div className="min-h-screen bg-charcoal-dark">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-white text-2xl font-light tracking-wide">Payment Options</h1>
            <p className="text-white/40 text-xs font-sans mt-1">
              Choose which payment modes appear on the booking page. You can enable multiple options.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || enabledCount === 0}
            className="flex items-center gap-2 bg-gold hover:bg-gold-dark disabled:opacity-40 text-charcoal-dark text-[10px] tracking-[0.2em] uppercase font-sans font-medium px-5 py-2.5 rounded-full transition-colors shrink-0"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        {/* Status messages */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-sm font-sans">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <p className="text-green-400 text-sm font-sans">Payment options saved successfully.</p>
          </div>
        )}

        {/* Preview note */}
        <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 flex items-start gap-3">
          <ChevronRight size={14} className="text-gold shrink-0 mt-0.5" />
          <p className="text-white/50 text-xs font-sans leading-relaxed">
            Enabled options appear on the booking payment page as selectable cards. Customers can pick any one option before confirming their booking.
            {enabledCount === 0 && (
              <span className="text-red-400 ml-1">⚠ At least one option must be enabled.</span>
            )}
          </p>
        </div>

        {/* Option cards */}
        {config.options.map((opt, index) => {
          const meta = OPTION_META[opt.type]
          const Icon = meta.icon
          const isAdvance = opt.type === 'ADVANCE'
          const advOpt = isAdvance ? (opt as AdvanceOption) : null

          return (
            <div
              key={opt.type}
              className={`bg-charcoal border rounded-2xl overflow-hidden transition-all ${
                opt.enabled
                  ? `${meta.borderColor} ring-1 ring-inset ${meta.borderColor}`
                  : 'border-white/5'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start gap-4 p-5">
                <div className={`w-10 h-10 rounded-xl ${meta.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon size={18} className={meta.iconColor} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Label input */}
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(index, { label: e.target.value })}
                    className="w-full bg-transparent text-white font-sans font-medium text-base focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5 transition-colors"
                    placeholder="Option label"
                  />
                  <p className="text-white/35 text-xs font-sans mt-1.5 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => updateOption(index, { enabled: !opt.enabled })}
                  className="shrink-0 transition-colors"
                  title={opt.enabled ? 'Disable this option' : 'Enable this option'}
                >
                  {opt.enabled ? (
                    <ToggleRight size={32} className={meta.iconColor} />
                  ) : (
                    <ToggleLeft size={32} className="text-white/20" />
                  )}
                </button>
              </div>

              {/* Advance sub-options (shown when ADVANCE is enabled) */}
              {isAdvance && opt.enabled && advOpt && (
                <div className="border-t border-white/5 px-5 py-4 space-y-4 bg-white/2">
                  <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans">
                    Advance Amount
                  </p>

                  {/* Mode selection */}
                  <div className="flex gap-3">
                    {(['percent', 'fixed'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateOption(index, { mode: m } as Partial<AdvanceOption>)}
                        className={`flex-1 py-2.5 text-[10px] tracking-[0.2em] uppercase font-sans rounded-xl border transition-colors ${
                          advOpt.mode === m
                            ? 'bg-gold text-charcoal-dark border-gold font-medium'
                            : 'border-white/10 text-white/40 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {m === 'percent' ? '% Percentage' : '₹ Fixed Amount'}
                      </button>
                    ))}
                  </div>

                  {/* Value input */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-sans pointer-events-none">
                        {advOpt.mode === 'percent' ? '%' : '₹'}
                      </span>
                      <input
                        type="number"
                        min={advOpt.mode === 'percent' ? 1 : 1}
                        max={advOpt.mode === 'percent' ? 99 : undefined}
                        step={advOpt.mode === 'percent' ? 1 : 50}
                        value={advOpt.value}
                        onChange={(e) =>
                          updateOption(index, {
                            value: parseFloat(e.target.value) || 0,
                          } as Partial<AdvanceOption>)
                        }
                        className="w-full bg-charcoal-dark border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-white text-sm font-sans focus:outline-none focus:border-gold/40"
                      />
                    </div>
                    <p className="text-white/30 text-xs font-sans shrink-0 max-w-[160px]">
                      {advOpt.mode === 'percent'
                        ? `E.g. 20% of ₹1000 = ₹200`
                        : `Customer pays exactly ₹${advOpt.value} now`}
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="bg-charcoal-dark rounded-xl px-4 py-2.5 border border-white/5">
                    <p className="text-white/40 text-[10px] font-sans tracking-wide">
                      Preview on booking page (for ₹1,000 total):
                    </p>
                    <p className="text-white/70 text-xs font-sans mt-1">
                      {advOpt.mode === 'percent'
                        ? `Pay ${advOpt.value}% now (₹${Math.round((advOpt.value / 100) * 1000)}) · ₹${1000 - Math.round((advOpt.value / 100) * 1000)} at salon`
                        : `Pay ₹${Math.min(advOpt.value, 1000)} now · ₹${Math.max(0, 1000 - advOpt.value)} at salon`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Info */}
        <div className="bg-white/2 border border-white/5 rounded-xl px-5 py-4 space-y-2">
          <p className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans">How it works</p>
          <ul className="space-y-1.5">
            {[
              'Enabled options appear as selectable cards on the booking payment page.',
              'If only one option is enabled, it is automatically pre-selected (no choice needed).',
              '"Pay in Full" and "Book with Advance" go through the payment gateway (PhonePe).',
              '"Pay at Salon" creates the booking immediately with no payment required.',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-white/30 text-xs font-sans leading-relaxed">
                <span className="text-gold/50 mt-0.5 shrink-0">·</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
