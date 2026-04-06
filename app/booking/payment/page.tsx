'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format, startOfDay, endOfDay, addDays, subMinutes, parseISO } from 'date-fns'
import PaymentScreen, { type ResolvedPaymentOption, type PaymentType } from '@/components/PaymentScreen'
import { parseBusinessHours, getDayConfig, isWithinClosingTime } from '@/lib/slots'
import { Phone } from 'lucide-react'

const ARRIVAL_BUFFER_MINUTES = 10

interface Service {
  id: string
  name: string
  price: number
  duration: number
  quantity?: number
}

function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [services, setServices] = useState<Service[]>([])
  const [groupSize, setGroupSize] = useState(1)
  const [groupPersons, setGroupPersons] = useState<Array<{ personIndex: number; services: Service[] }>>([])
  const [hasData, setHasData] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [totalBump, setTotalBump] = useState(false)
  const [showClosingTimePopup, setShowClosingTimePopup] = useState(false)
  const [showArrivalPopup, setShowArrivalPopup] = useState(false)
  const [locationMobile, setLocationMobile] = useState<string | null>(null)
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentType | null>(null)
  const [paymentOptions, setPaymentOptions] = useState<ResolvedPaymentOption[]>([])
  const [businessHoursJson, setBusinessHoursJson] = useState<string | null>(null)
  const [retryBookingId, setRetryBookingId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('payment_completed') === '1') {
      sessionStorage.removeItem('payment_completed')
      router.replace('/')
      return
    }

    const error = searchParams.get('error')
    const bookingId = searchParams.get('bookingId')

    if (error && bookingId) {
      setPaymentError(error === 'payment_failed' ? 'Payment failed or was cancelled. You can retry below.' : error === 'callback_failed' ? 'Could not verify payment. Please retry.' : 'Something went wrong.')
      setRetryBookingId(bookingId)
      fetch(`/api/booking/${bookingId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.services) {
            setServices(data.services.map((s: { id: string; name: string; price: number; duration?: number; quantity?: number }) => ({
              id: s.id,
              name: s.name,
              price: s.price,
              duration: s.duration ?? 30,
              quantity: s.quantity ?? 1,
            })))
          }
          setHasData(true)
        })
        .catch(() => {
          setPaymentError('Could not load booking. Please start a new booking.')
          setHasData(true)
        })
      return
    }

    const location = sessionStorage.getItem('bookingLocation')
    const servicesData = sessionStorage.getItem('selectedServices')
    const customer = sessionStorage.getItem('customerDetails')
    const dateTime = sessionStorage.getItem('bookingDateTime')

    if (!location || !customer || !dateTime) {
      router.push('/booking/location')
      return
    }
    
    // Parse services — support both v2 group format and legacy flat array
    let flatServices: Service[] = []
    let parsedGroupSize = 1
    let parsedPersons: Array<{ personIndex: number; services: Service[] }> = []

    if (servicesData) {
      try {
        const p = JSON.parse(servicesData)
        if (p?.version === 2 && Array.isArray(p.persons)) {
          parsedGroupSize = p.groupSize ?? 1
          parsedPersons = p.persons.map((person: { personIndex: number; services: Service[] }) => ({
            personIndex: person.personIndex,
            services: person.services.map((s) => ({ ...s, quantity: (s as Service & { quantity?: number }).quantity ?? 1 })),
          }))
          flatServices = parsedPersons.flatMap((person) => person.services)
        } else if (Array.isArray(p)) {
          flatServices = p.map((s) => ({ ...s, quantity: (s as Service & { quantity?: number }).quantity ?? 1 }))
          parsedPersons = [{ personIndex: 0, services: flatServices }]
        }
      } catch {
        flatServices = []
      }
    }
    setGroupSize(parsedGroupSize)
    setGroupPersons(parsedPersons)
    setServices(flatServices)
    setHasData(true)

    // Fetch payment options from admin config
    const total = flatServices.reduce((sum, s) => sum + s.price * ((s as Service & { quantity?: number }).quantity ?? 1), 0)
    fetch(`/api/booking/payment-config?total=${total}`)
      .then((r) => r.json())
      .then((data: { options: ResolvedPaymentOption[] }) => {
        setPaymentOptions(data.options || [])
        // Auto-select if only one option
        if (data.options?.length === 1) {
          setSelectedPaymentType(data.options[0].type)
        }
      })
      .catch(() => {})

    // Fetch business hours for closing-time validation
    const loc = JSON.parse(location) as { id: string; mobile?: string | null }
    if (loc.mobile) setLocationMobile(loc.mobile)
    const dt = JSON.parse(dateTime) as { date: string; timeSlot: string }
    const startDate = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const endDate = format(endOfDay(addDays(new Date(), 30)), 'yyyy-MM-dd')
    fetch(`/api/slots/availability?startDate=${startDate}&endDate=${endDate}&locationId=${encodeURIComponent(loc.id)}`)
      .then((r) => r.json())
      .then((data) => setBusinessHoursJson(data.businessHours ?? null))
      .catch(() => {})
  }, [router, searchParams])

  const wouldExceedClosing = (svc: Service[]): boolean => {
    if (svc.length === 0 || !businessHoursJson) return false
    const dateTime = sessionStorage.getItem('bookingDateTime')
    if (!dateTime) return false
    const dt = JSON.parse(dateTime) as { date: string; timeSlot: string }
    const duration = svc.reduce((sum, s) => sum + s.duration * (s.quantity ?? 1), 0)
    const businessHours = parseBusinessHours(businessHoursJson)
    const dayConfig = getDayConfig(businessHours, new Date(dt.date).getDay())
    const closeTime = dayConfig.closeTime || '18:00'
    return !isWithinClosingTime(dt.timeSlot, duration, closeTime)
  }

  const handleServicesChange = (updated: Service[]) => {
    if (wouldExceedClosing(updated)) {
      setShowClosingTimePopup(true)
      return
    }
    setServices(updated)
    sessionStorage.setItem('selectedServices', JSON.stringify(updated))
    setTotalBump(true)
    setTimeout(() => setTotalBump(false), 400)
  }

  useEffect(() => {
    if (services.length === 0 || !businessHoursJson) return
    const dateTime = sessionStorage.getItem('bookingDateTime')
    if (!dateTime) return
    const dt = JSON.parse(dateTime) as { date: string; timeSlot: string }
    const duration = services.reduce((sum, s) => sum + s.duration * (s.quantity ?? 1), 0)
    const businessHours = parseBusinessHours(businessHoursJson)
    const bookingDate = new Date(dt.date)
    const dayConfig = getDayConfig(businessHours, bookingDate.getDay())
    const closeTime = dayConfig.closeTime || '18:00'
    if (!isWithinClosingTime(dt.timeSlot, duration, closeTime)) {
      setShowClosingTimePopup(true)
    }
  }, [services, businessHoursJson])

  const doPayment = async (paymentType: PaymentType) => {
    setIsProcessing(true)
    try {
      if (retryBookingId) {
        const res = await fetch('/api/payment/retry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: retryBookingId }),
        })
        const data = await res.json()
        if (data.redirectUrl) {
          router.replace(data.redirectUrl)
          return
        }
        if (data.paymentUrl) {
          window.location.href = data.paymentUrl
          return
        }
        if (data.error) {
          alert(data.error)
          setIsProcessing(false)
          return
        }
        alert('Failed to retry payment. Please try again.')
        setIsProcessing(false)
        return
      }

      const customerDetails = JSON.parse(sessionStorage.getItem('customerDetails') || '{}')
      const dateTime = JSON.parse(sessionStorage.getItem('bookingDateTime') || '{}')
      const location = JSON.parse(sessionStorage.getItem('bookingLocation') || '{}')

      // Send group booking format
      const groupServicesPayload = groupPersons.length > 0
        ? groupPersons.map((person) => ({
            personIndex: person.personIndex,
            serviceIds: person.services.flatMap((s) =>
              Array((s as Service & { quantity?: number }).quantity ?? 1).fill(s.id)
            ),
          }))
        : [{ personIndex: 0, serviceIds: services.flatMap((s) => Array((s as Service & { quantity?: number }).quantity ?? 1).fill(s.id)) }]

      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: location.id,
          groupServices: groupServicesPayload,
          groupSize,
          customerDetails,
          date: dateTime.date,
          timeSlot: dateTime.timeSlot,
          paymentType,
        }),
      })

      const data = await response.json()

      if (data.error) {
        alert(data.error)
        setIsProcessing(false)
        return
      }

      // FREE (pay at salon): booking confirmed immediately, no gateway
      if (data.noPayment) {
        sessionStorage.removeItem('bookingLocation')
        sessionStorage.removeItem('selectedServices')
        sessionStorage.removeItem('customerDetails')
        sessionStorage.removeItem('bookingDateTime')
        router.replace(`/booking/confirmation?bookingId=${data.bookingId}`)
        return
      }

      // PhonePe: redirect to PayPage
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      
      // Use test payment in development or when useTestPayment flag is set
      if (data.useTestPayment || !data.paymentUrl) {
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const testResponse = await fetch('/api/payment/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: data.bookingId }),
        })
        
        const testData = await testResponse.json()
        
        if (testData.error) {
          alert(testData.error)
          setIsProcessing(false)
          return
        }
        
        if (testData.redirectUrl) {
          sessionStorage.removeItem('bookingLocation')
          sessionStorage.removeItem('selectedServices')
          sessionStorage.removeItem('customerDetails')
          sessionStorage.removeItem('bookingDateTime')
          router.replace(testData.redirectUrl)
          return
        }
      }
      
      sessionStorage.removeItem('bookingLocation')
      sessionStorage.removeItem('selectedServices')
      sessionStorage.removeItem('customerDetails')
      sessionStorage.removeItem('bookingDateTime')
      router.replace(`/booking/confirmation?bookingId=${data.bookingId}`)
    } catch (error) {
      console.error('Error initiating payment:', error)
      alert('Failed to initiate payment. Please try again.')
      setIsProcessing(false)
    }
  }

  const handlePaymentTypeSelect = (paymentType: PaymentType) => {
    if (services.length === 0) return
    if (wouldExceedClosing(services)) {
      setShowClosingTimePopup(true)
      return
    }
    setShowArrivalPopup(true)
    setSelectedPaymentType(paymentType)
  }

  const handleArrivalConfirm = () => {
    setShowArrivalPopup(false)
  }

  const handlePaymentInitiate = (paymentType: PaymentType, paymentMethod?: string) => {
    if (services.length === 0) {
      alert('Please add at least one service to proceed with payment.')
      return
    }
    if (showClosingTimePopup) return
    doPayment(paymentType)
  }

  if (!hasData) {
    return null
  }

  const totalAmount = services.reduce((sum, s) => sum + s.price * ((s as Service & { quantity?: number }).quantity ?? 1), 0)
  // Parallel duration: max of per-person totals for group, sequential for solo
  const totalDurationMinutes = groupPersons.length > 1
    ? Math.max(...groupPersons.map((p) => p.services.reduce((sum, s) => sum + s.duration * ((s as Service & { quantity?: number }).quantity ?? 1), 0)), 0)
    : services.reduce((sum, s) => sum + s.duration * ((s as Service & { quantity?: number }).quantity ?? 1), 0)

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins} min`
    const hrs = Math.floor(mins / 60)
    const remainder = mins % 60
    return remainder > 0 ? `${hrs} hr${hrs !== 1 ? 's' : ''} ${remainder} min` : `${hrs} hr${hrs !== 1 ? 's' : ''}`
  }

  const getArrivalInfo = () => {
    const dateTime = sessionStorage.getItem('bookingDateTime')
    if (!dateTime) return { arrival: '—', appointment: '—' }
    const dt = JSON.parse(dateTime) as { date: string; timeSlot: string }
    const [h, m] = (dt.timeSlot || '09:00').split(':').map(Number)
    const base = parseISO(dt.date)
    const slotDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0)
    const arrivalDate = subMinutes(slotDate, ARRIVAL_BUFFER_MINUTES)
    return {
      arrival: format(arrivalDate, 'EEE, MMM d \'at\' h:mm a'),
      appointment: format(slotDate, 'EEE, MMM d \'at\' h:mm a'),
    }
  }

  const arrivalInfo = getArrivalInfo()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
          <h1 className="text-lg sm:text-2xl font-semibold text-gray-900 mb-0.5 sm:mb-2">Payment</h1>
          <p className="text-xs sm:text-sm text-gray-500">Complete your booking with secure payment</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {paymentError && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            {paymentError}
          </div>
        )}
        {isProcessing ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-6 sm:p-12 shadow-sm text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-black mb-3 sm:mb-4"></div>
            <p className="text-base sm:text-xl font-light text-gray-900 mb-2">Processing Payment...</p>
            <p className="text-xs sm:text-sm text-gray-500 font-light">Please wait while we process your payment</p>
          </div>
        ) : (
          <>
            {showArrivalPopup && selectedPaymentType && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Please be present on time</h3>
                  <div className="space-y-3 text-sm text-gray-600 mb-6">
                    <p>
                      <span className="font-medium text-gray-700">Arrive by:</span>{' '}
                      {arrivalInfo.arrival}
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Appointment time:</span>{' '}
                      {arrivalInfo.appointment}
                    </p>
                    <p>
                      <span className="font-medium text-gray-700">Total duration:</span>{' '}
                      {formatDuration(totalDurationMinutes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleArrivalConfirm}
                    className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
            {showClosingTimePopup && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Please book another time</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Your selected appointment time and services would end <strong>after our salon closing time</strong>. We need to close on time to serve all our customers properly.
                  </p>
                  <p className="text-gray-500 text-xs mb-6">
                    Please go back and choose an earlier time slot so your appointment can be completed before we close.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push('/booking/date-time')}
                      className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
                    >
                      Change date & time
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowClosingTimePopup(false); router.push('/booking/services') }}
                      className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                    >
                      Reduce services
                    </button>
                    {locationMobile && (
                      <a
                        href={`tel:${locationMobile}`}
                        className="w-full py-2.5 flex items-center justify-center gap-2 border border-gray-300 text-gray-700 rounded-lg font-medium bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <Phone size={15} />
                        Call salon for custom booking
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClosingTimePopup(false)}
                      className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {services.length === 0 ? (
              <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-6 sm:p-12 shadow-sm text-center">
                <p className="text-gray-600 mb-4">You haven&apos;t added any services yet.</p>
                <p className="text-sm text-gray-500 mb-6">Add at least one service to proceed with payment.</p>
                <button
                  type="button"
                  onClick={() => router.push('/booking/services')}
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800"
                >
                  Add services
                </button>
              </div>
            ) : (
            <PaymentScreen
              services={services}
              totalAmount={totalAmount}
              onPaymentInitiate={handlePaymentInitiate}
              onServicesChange={handleServicesChange}
              totalBump={totalBump}
              disabled={showClosingTimePopup}
              selectedPaymentType={selectedPaymentType}
              onPaymentTypeSelect={handlePaymentTypeSelect}
              paymentOptions={paymentOptions.length > 0 ? paymentOptions : undefined}
            />
            )}
            <p className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
              <Link href="/terms" className="text-primary-600 hover:underline">Terms</Link>
              {' · '}
              <Link href="/privacy" className="text-primary-600 hover:underline">Privacy</Link>
              {' · '}
              <Link href="/refund" className="text-primary-600 hover:underline">Refund Policy</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    }>
      <PaymentPageContent />
    </Suspense>
  )
}
