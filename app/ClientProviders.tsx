'use client'

import { CurrencyProvider } from '@/lib/CurrencyContext'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <CurrencyProvider>{children}</CurrencyProvider>
}
