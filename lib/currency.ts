/**
 * Dynamic currency formatter.
 * Uses Intl.NumberFormat with the configured ISO 4217 currency code.
 * Falls back to EUR if the code is invalid.
 */
export function formatCurrency(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/**
 * PDF-safe format: returns "EUR 1,234.00" style string.
 * Avoids symbol rendering issues in jsPDF with non-Latin fonts.
 */
export function formatCurrencyPdf(amount: number, currency = 'EUR', decimals = 2): string {
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
    return `${currency} ${formatted}`
  } catch {
    return `${currency} ${amount.toFixed(decimals)}`
  }
}
