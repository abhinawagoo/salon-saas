/**
 * lib/paymentConfig.ts
 * Shared types + helpers for the configurable payment options feature.
 *
 * Admin chooses which of these 3 modes to expose to customers:
 *   FULL    – pay 100% now via gateway
 *   ADVANCE – pay a partial amount (% of total or fixed ₹ amount) now
 *   FREE    – no payment now; pay at salon
 *
 * At least one option must be enabled.
 * Config is stored as paymentConfigJson in SiteCustomization (id=1).
 */

export type PaymentType = 'FULL' | 'ADVANCE' | 'FREE'

export type FullOption = {
  type: 'FULL'
  enabled: boolean
  label: string
}

export type AdvanceOption = {
  type: 'ADVANCE'
  enabled: boolean
  label: string
  mode: 'percent' | 'fixed' // percent of total OR fixed ₹ amount
  value: number             // percentage (1–99) or fixed ₹ amount
}

export type FreeOption = {
  type: 'FREE'
  enabled: boolean
  label: string
}

export type PaymentOptionConfig = FullOption | AdvanceOption | FreeOption

export type PaymentConfig = {
  options: PaymentOptionConfig[]
}

// ─── Default config (used when nothing is saved in DB) ────────────────────────

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  options: [
    { type: 'FULL', enabled: true, label: 'Pay in Full' },
    { type: 'ADVANCE', enabled: false, label: 'Book with Advance', mode: 'percent', value: 20 },
    { type: 'FREE', enabled: false, label: 'Pay at Salon' },
  ],
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parsePaymentConfig(json: string | null | undefined): PaymentConfig {
  if (!json) return DEFAULT_PAYMENT_CONFIG
  try {
    const parsed = JSON.parse(json) as Partial<PaymentConfig>
    if (!Array.isArray(parsed.options) || parsed.options.length === 0) {
      return DEFAULT_PAYMENT_CONFIG
    }
    // Validate and fill defaults for each option
    const options: PaymentOptionConfig[] = []
    for (const opt of parsed.options) {
      if (opt.type === 'FULL') {
        options.push({ type: 'FULL', enabled: !!opt.enabled, label: opt.label || 'Pay in Full' })
      } else if (opt.type === 'ADVANCE') {
        const a = opt as AdvanceOption
        options.push({
          type: 'ADVANCE',
          enabled: !!a.enabled,
          label: a.label || 'Book with Advance',
          mode: a.mode === 'fixed' ? 'fixed' : 'percent',
          value: typeof a.value === 'number' && a.value > 0 ? a.value : 20,
        })
      } else if (opt.type === 'FREE') {
        options.push({ type: 'FREE', enabled: !!opt.enabled, label: opt.label || 'Pay at Salon' })
      }
    }
    if (options.length === 0) return DEFAULT_PAYMENT_CONFIG
    return { options }
  } catch {
    return DEFAULT_PAYMENT_CONFIG
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEnabledOptions(config: PaymentConfig): PaymentOptionConfig[] {
  return config.options.filter((o) => o.enabled)
}

/** Calculate the payment amount for a given option and total. */
export function calcOptionAmount(opt: PaymentOptionConfig, totalAmount: number): number {
  if (opt.type === 'FULL') return totalAmount
  if (opt.type === 'FREE') return 0
  // ADVANCE
  if (opt.mode === 'fixed') {
    return Math.min(opt.value, totalAmount) // never charge more than total
  }
  // percent
  return Math.round((opt.value / 100) * totalAmount * 100) / 100
}

/** Description shown below option label (e.g. "20% of €2000 = €400") */
export function calcOptionDescription(opt: PaymentOptionConfig, totalAmount: number, currency = 'EUR'): string {
  if (opt.type === 'FULL') return 'Pay complete amount now'
  if (opt.type === 'FREE') return 'Pay the full amount when you arrive'
  const fmt = (n: number) => `${currency} ${Math.round(n)}`
  if (opt.mode === 'fixed') {
    const amt = Math.min(opt.value, totalAmount)
    const bal = totalAmount - amt
    return `Pay ${fmt(amt)} now · ${fmt(bal)} at salon`
  }
  const amt = calcOptionAmount(opt, totalAmount)
  const bal = totalAmount - amt
  return `Pay ${opt.value}% now (${fmt(amt)}) · ${fmt(bal)} at salon`
}

/** Validate config before saving. Returns error string or null. */
export function validatePaymentConfig(config: PaymentConfig): string | null {
  const enabled = getEnabledOptions(config)
  if (enabled.length === 0) return 'At least one payment option must be enabled.'
  for (const opt of config.options) {
    if (opt.type === 'ADVANCE') {
      if (opt.mode === 'percent' && (opt.value <= 0 || opt.value >= 100)) {
        return 'Advance percentage must be between 1 and 99.'
      }
      if (opt.mode === 'fixed' && opt.value <= 0) {
        return 'Advance fixed amount must be greater than 0.'
      }
    }
    if (!opt.label?.trim()) return 'Each option must have a label.'
  }
  return null
}
