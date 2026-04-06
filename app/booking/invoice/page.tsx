'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { formatTime12h } from '@/lib/formatTime'
import TaxInvoice from '@/components/TaxInvoice'

interface Service {
  id: string
  name: string
  price: number
}

function InvoicePageContent() {
  const searchParams = useSearchParams()
  const [bookingData, setBookingData] = useState<{
    token: string
    billNo?: string
    date: string
    timeSlot: string
    locationName?: string
    locationAddress?: string
    locationMobile?: string
    locationImageUrl?: string
    services: Service[]
    paymentStatus: string
    totalAmount: number
    amountPaid: number
    dueAmount: number
    onlineAmount: number
    cashAmount: number
    customerName?: string
    customerMobile?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoiceSettings, setInvoiceSettings] = useState<{ brandName?: string; website?: string; gstNumber?: string; terms?: string; invoiceSignatureUrl?: string }>({})

  useEffect(() => {
    document.body.dataset.page = 'invoice'
    return () => { delete document.body.dataset.page }
  }, [])

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('Missing booking token')
      setLoading(false)
      return
    }
    Promise.all([
      fetch(`/api/booking/by-token?token=${encodeURIComponent(token)}`).then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Booking not found' : 'Failed to load')
        return res.json()
      }),
      fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([data, settings]) => {
        setBookingData({
          ...data,
          date: typeof data.date === 'string' ? data.date : data.date?.slice?.(0, 10),
        })
        setInvoiceSettings({
          brandName: settings.brandName,
          website: settings.invoiceWebsite ?? 'shahnazsalonsasaram.com',
          gstNumber: settings.invoiceGst ?? undefined,
          terms: settings.invoiceTerms ?? '',
          invoiceSignatureUrl: settings.invoiceSignatureUrl ?? undefined,
        })
      })
      .catch((e) => setError(e.message || 'Something went wrong'))
      .finally(() => setLoading(false))
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto" />
          <p className="mt-4 text-gray-600">Loading booking...</p>
        </div>
      </div>
    )
  }

  if (error || !bookingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Booking not found</h1>
          <p className="text-gray-600">{error || 'Invalid or expired link.'}</p>
          <a href="/" className="inline-block mt-6 text-primary-600 hover:underline">
            Back to home
          </a>
        </div>
      </div>
    )
  }

  const dateObj = typeof bookingData.date === 'string' ? new Date(bookingData.date) : new Date(bookingData.date)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 overflow-x-hidden print:min-h-0 print:bg-white print:py-0 print:px-0">
      <div className="max-w-[800px] mx-auto min-w-0">
        <div className="text-center mb-6 print:hidden">
          <h1 className="text-2xl font-bold text-gray-900">Your booking & bill</h1>
          <p className="text-gray-600 mt-1">View details and print your bill</p>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <button
              onClick={() => window.print()}
              className="bg-black text-white px-6 py-3 rounded-full font-light hover:bg-gray-800 transition-all duration-200 flex items-center gap-2 shadow-lg"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        </div>

        {/* Tax Invoice - clean professional layout, A4 optimized for print */}
        <TaxInvoice
          data={{
            salonName: (invoiceSettings.brandName || bookingData.locationName || 'SALON').toUpperCase(),
            phone: bookingData.locationMobile ?? undefined,
            address: bookingData.locationAddress ?? undefined,
            website: invoiceSettings.website ?? 'shahnazsalonsasaram.com',
            gstNumber: invoiceSettings.gstNumber ?? undefined,
            logoUrl: bookingData.locationImageUrl ?? undefined,
            signatureUrl: invoiceSettings.invoiceSignatureUrl ?? undefined,
            invoiceNo: bookingData.billNo ?? bookingData.token,
            invoiceDate: format(dateObj, 'dd/MM/yyyy'),
            appointmentTime: bookingData.timeSlot ? formatTime12h(bookingData.timeSlot) : undefined,
            customerName: bookingData.customerName ?? undefined,
            customerMobile: bookingData.customerMobile ?? undefined,
            services: bookingData.services,
            totalAmount: bookingData.totalAmount,
            amountPaid: bookingData.amountPaid,
            dueAmount: bookingData.dueAmount,
            terms: invoiceSettings.terms,
          }}
        />
      </div>
    </div>
  )
}

export default function InvoicePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <InvoicePageContent />
    </Suspense>
  )
}
