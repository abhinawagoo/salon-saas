'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { formatCurrency } from './currency'

interface CurrencyContextValue {
  currency: string
  formatPrice: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'EUR',
  formatPrice: (amount) => formatCurrency(amount, 'EUR'),
})

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState('EUR')

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => { if (data.currency) setCurrency(data.currency) })
      .catch(() => {})
  }, [])

  const formatPrice = (amount: number) => formatCurrency(amount, currency)

  return (
    <CurrencyContext.Provider value={{ currency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
