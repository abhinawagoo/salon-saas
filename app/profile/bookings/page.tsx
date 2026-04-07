'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, MapPin, CreditCard, RefreshCw, XCircle } from 'lucide-react'
import { format, addDays, startOfDay, endOfDay } from 'date-fns'
import { formatTime12h } from '@/lib/formatTime'
import { AUTH_DISABLED_FOR_NOW } from '@/lib/auth'
import { useCurrency } from '@/lib/CurrencyContext'
import DateTimePicker from '@/components/DateTimePicker'

interface BookingItem {
  id: string
  token: string
  date: string
  timeSlot: string
  status: string
  locationId?: string | null
  locationName?: string
  locationAddress?: string
  durationMinutes?: number
  services: { name: string; price: number }[]
  totalAmount: number
  amountPaid: number
  paymentStatus: string
}

export default function ProfileBookingsPage() {
  const { formatPrice } = useCurrency()
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [rescheduleBooking, setRescheduleBooking] = useState<BookingItem | null>(null)
  const [rescheduleLocationId, setRescheduleLocationId] = useState<string | null>(null)
  const [locations, setLocations] = useState<{ id: string; name: string; address: string | null }[]>([])
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({})
  const [businessHours, setBusinessHours] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string | null>(null)
  const [rescheduleSaving, setRescheduleSaving] = useState(false)
  const [cancelBooking, setCancelBooking] = useState<BookingItem | null>(null)
  const [cancelSaving, setCancelSaving] = useState(false)

  const fetchSlotAvailability = async (locationId: string, excludeBookingId?: string) => {
    try {
      const startDate = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const endDate = format(endOfDay(addDays(new Date(), 30)), 'yyyy-MM-dd')
      let url = `/api/slots/availability?startDate=${startDate}&endDate=${endDate}&locationId=${encodeURIComponent(locationId)}`
      if (excludeBookingId) url += `&excludeBookingId=${encodeURIComponent(excludeBookingId)}`
      const res = await fetch(url)
      const data = await res.json()
      setSlotCounts(data.slotCounts ?? data)
      setBusinessHours(data.businessHours ?? null)
      setClosedDates(data.closedDates ?? null)
    } catch {
      setSlotCounts({})
      setBusinessHours(null)
      setClosedDates(null)
    }
  }

  useEffect(() => {
    const authDisabled = AUTH_DISABLED_FOR_NOW || process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
    if (authDisabled) {
      setBookings([])
      setLoading(false)
      return
    }
    fetch('/api/user/bookings')
      .then((r) => {
        if (r.status === 401) {
          router.push('/login?returnTo=/profile/bookings')
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setBookings(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    fetch('/api/locations')
      .then((r) => r.json())
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => [])
  }, [])

  useEffect(() => {
    if (rescheduleBooking) {
      setRescheduleLocationId(rescheduleBooking.locationId ?? null)
    }
  }, [rescheduleBooking?.id])

  useEffect(() => {
    if (rescheduleLocationId) {
      fetchSlotAvailability(rescheduleLocationId, rescheduleBooking?.id)
    } else {
      setSlotCounts({})
      setBusinessHours(null)
      setClosedDates(null)
    }
  }, [rescheduleLocationId, rescheduleBooking?.id])

  const handleRescheduleSelect = async (date: Date, timeSlot: string) => {
    if (!rescheduleBooking || !rescheduleLocationId) return
    setRescheduleSaving(true)
    try {
      const res = await fetch(`/api/user/bookings/${rescheduleBooking.id}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date.toISOString(), timeSlot, locationId: rescheduleLocationId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to reschedule')
      const newLoc = locations.find((l) => l.id === rescheduleLocationId)
      setBookings((prev) =>
        prev.map((b) =>
          b.id === rescheduleBooking.id
            ? { ...b, date: date.toISOString(), timeSlot, locationId: rescheduleLocationId, locationName: newLoc?.name, locationAddress: newLoc?.address ?? undefined }
            : b
        )
      )
      setRescheduleBooking(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reschedule')
    } finally {
      setRescheduleSaving(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelBooking) return
    setCancelSaving(true)
    try {
      const res = await fetch(`/api/user/bookings/${cancelBooking.id}/cancel`, {
        method: 'PATCH',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to cancel')
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelBooking.id ? { ...b, status: 'CANCELLED' } : b
        )
      )
      setCancelBooking(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancelSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">My Bookings</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No bookings yet.</p>
            <Link
              href="/booking/location"
              className="inline-block mt-4 text-primary-600 font-medium hover:underline"
            >
              Book an appointment
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-gray-500">
                    #{b.token}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      b.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : b.status === 'CANCELLED'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={16} />
                    {format(new Date(b.date), 'EEEE, MMM d, yyyy')} at {formatTime12h(b.timeSlot)}
                  </div>
                  {(b.locationName || b.locationAddress) && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin size={16} className="shrink-0 mt-0.5" />
                      <span>{b.locationName}{b.locationAddress ? ` · ${b.locationAddress}` : ''}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-medium text-gray-700 mb-1">Services</p>
                    <ul className="text-gray-600 space-y-0.5">
                      {b.services.map((s, i) => (
                        <li key={i}>
                          {s.name} — {formatPrice(s.price)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2 text-sm pt-2 border-t border-gray-100">
                    <CreditCard size={16} />
                    <span>Total {formatPrice(b.totalAmount)}</span>
                    <span className="text-gray-500">· Paid {formatPrice(b.amountPaid)}</span>
                    <span className="text-gray-500">· {b.paymentStatus}</span>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/booking/invoice?token=${encodeURIComponent(b.token)}`}
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    View invoice
                  </Link>
                  {b.status === 'BOOKED' && new Date(b.date) >= new Date(new Date().toDateString()) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRescheduleBooking(b)}
                        className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw size={14} />
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelBooking(b)}
                        className="text-sm font-medium text-red-600 hover:underline flex items-center gap-1"
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reschedule modal */}
        {rescheduleBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Reschedule appointment</h2>
                <p className="text-sm text-gray-500 mb-4">#{rescheduleBooking.token}</p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <div className="space-y-2">
                    {locations.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setRescheduleLocationId(loc.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          rescheduleLocationId === loc.id
                            ? 'border-primary-600 bg-primary-50 text-primary-800'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium">{loc.name}</span>
                        {loc.address && <span className="text-xs text-gray-500 block mt-0.5">{loc.address}</span>}
                      </button>
                    ))}
                  </div>
                  {locations.length === 0 && <p className="text-sm text-gray-500">Loading locations...</p>}
                </div>

                {rescheduleLocationId && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date & time</label>
                    <DateTimePicker
                      onSelect={handleRescheduleSelect}
                      slotCounts={slotCounts}
                      durationMinutes={rescheduleBooking.durationMinutes ?? 30}
                      businessHoursJson={businessHours}
                      closedDatesJson={closedDates}
                    />
                  </>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setRescheduleBooking(null); setRescheduleLocationId(null) }}
                    disabled={rescheduleSaving}
                    className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel confirmation modal */}
        {cancelBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Cancel appointment?</h2>
              <p className="text-sm text-gray-600 mb-4">
                This will cancel your booking #{cancelBooking.token} for{' '}
                {format(new Date(cancelBooking.date), 'MMM d, yyyy')} at {formatTime12h(cancelBooking.timeSlot)}.
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setCancelBooking(null)}
                  disabled={cancelSaving}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  disabled={cancelSaving}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelSaving ? 'Cancelling...' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
