'use client'

import { useState, useEffect } from 'react'
import { format, isToday, isAfter } from 'date-fns'
import Link from 'next/link'
import { formatTime12h } from '@/lib/formatTime'
import { CheckCircle, Clock, Phone, User, Banknote, Printer, Copy, MapPin, Edit3, Send } from 'lucide-react'
import { setUserRole } from '@/lib/auth'
import { useCurrency } from '@/lib/CurrencyContext'

interface Location {
  id: string
  name: string
  slug: string
  address: string | null
  mobile: string | null
  imageUrl: string | null
}

interface ServiceItem {
  id: string
  name: string
  price: number
  duration: number
}

interface Booking {
  id: string
  token: string
  date: string
  timeSlot: string
  status: string
  location?: { id: string; name: string; address: string | null; mobile: string | null; imageUrl: string | null } | null
  user: {
    name: string
    mobile: string
  }
  services: Array<{
    service: {
      name: string
    }
    price: number
    quantity?: number
  }>
  payment: {
    paymentStatus: string
    amount: number
    totalAmount: number
    amountPaid: number
    onlineAmount: number
    cashAmount: number
  } | null
}

export default function StaffDashboard() {
  const { formatPrice } = useCurrency()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [todayBookings, setTodayBookings] = useState<Booking[]>([])
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [paymentModal, setPaymentModal] = useState<{ booking: Booking; mode: 'add_cash' | 'edit' } | null>(null)
  const [cashInput, setCashInput] = useState('')
  const [editOnline, setEditOnline] = useState('')
  const [editCash, setEditCash] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [copiedMobile, setCopiedMobile] = useState<string | null>(null)
  const [sendInvoiceBooking, setSendInvoiceBooking] = useState<Booking | null>(null)
  const [sendInvoiceMobile, setSendInvoiceMobile] = useState('')
  const [sendInvoiceSending, setSendInvoiceSending] = useState(false)
  const [editServicesBooking, setEditServicesBooking] = useState<Booking | null>(null)
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([])
  const [servicesQty, setServicesQty] = useState<Record<string, number>>({})
  const [servicesLoading, setServicesLoading] = useState(false)
  const [editServicesSaving, setEditServicesSaving] = useState(false)

  useEffect(() => {
    setUserRole('STAFF')
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => [])
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [selectedLocationId])

  const fetchBookings = async () => {
    try {
      const url = selectedLocationId
        ? `/api/staff/bookings/today?locationId=${encodeURIComponent(selectedLocationId)}`
        : '/api/staff/bookings/today'
      const response = await fetch(url)
      const data = await response.json()
      
      const today = data.filter((b: Booking) => isToday(new Date(b.date)))
      const upcoming = data.filter((b: Booking) => 
        isAfter(new Date(b.date), new Date()) && !isToday(new Date(b.date))
      )
      
      setTodayBookings(today)
      setUpcomingBookings(upcoming)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkCompleted = async (bookingId: string) => {
    try {
      await fetch(`/api/staff/booking/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      fetchBookings()
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Failed to update booking status')
    }
  }

  const handleCopyMobile = async (mobile: string) => {
    try {
      await navigator.clipboard.writeText(mobile)
      setCopiedMobile(mobile)
      setTimeout(() => setCopiedMobile(null), 2000)
    } catch {
      alert('Could not copy')
    }
  }

  const openAddCashModal = (booking: Booking) => {
    setPaymentModal({ booking, mode: 'add_cash' })
    setCashInput('')
  }

  const openEditPaymentModal = (booking: Booking) => {
    setPaymentModal({ booking, mode: 'edit' })
    const p = booking.payment
    setEditOnline(String(p?.onlineAmount ?? 0))
    setEditCash(String(p?.cashAmount ?? 0))
  }

  const closePaymentModal = () => {
    setPaymentModal(null)
    setCashInput('')
    setEditOnline('')
    setEditCash('')
  }

  const handleRecordCash = async () => {
    if (!paymentModal || paymentModal.mode !== 'add_cash') return
    const amount = parseFloat(cashInput)
    if (isNaN(amount) || amount <= 0) {
      alert('Enter a valid amount')
      return
    }
    setPaymentSaving(true)
    try {
      const res = await fetch(`/api/booking/${paymentModal.booking.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addCash: amount }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to record cash')
      }
      closePaymentModal()
      fetchBookings()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to record cash')
    } finally {
      setPaymentSaving(false)
    }
  }

  const handleSaveEditPayment = async () => {
    if (!paymentModal || paymentModal.mode !== 'edit') return
    const online = parseFloat(editOnline)
    const cash = parseFloat(editCash)
    if (isNaN(online) || isNaN(cash) || online < 0 || cash < 0) {
      alert('Enter valid amounts (non-negative numbers)')
      return
    }
    setPaymentSaving(true)
    try {
      const res = await fetch(`/api/booking/${paymentModal.booking.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlineAmount: online, cashAmount: cash }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update payment')
      }
      closePaymentModal()
      fetchBookings()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  const openEditServicesModal = async (booking: Booking) => {
    setEditServicesBooking(booking)
    setServicesQty({})
    setServicesLoading(true)
    try {
      const res = await fetch('/api/admin/services')
      const data = await res.json()
      setAvailableServices(Array.isArray(data) ? data : [])
    } catch {
      setAvailableServices([])
    } finally {
      setServicesLoading(false)
    }
  }

  const closeEditServicesModal = () => {
    setEditServicesBooking(null)
    setAvailableServices([])
    setServicesQty({})
  }

  const handleSaveServices = async () => {
    if (!editServicesBooking) return
    const serviceIds = Object.entries(servicesQty)
      .filter(([, qty]) => qty > 0)
      .flatMap(([id, qty]) => Array<string>(qty).fill(id))
    if (serviceIds.length === 0) {
      closeEditServicesModal()
      return
    }
    setEditServicesSaving(true)
    try {
      const res = await fetch(`/api/staff/booking/${editServicesBooking.id}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add services')
      }
      closeEditServicesModal()
      fetchBookings()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add services')
    } finally {
      setEditServicesSaving(false)
    }
  }

  const openSendInvoiceModal = (booking: Booking) => {
    setSendInvoiceBooking(booking)
    setSendInvoiceMobile(booking.user.mobile || '')
  }

  const closeSendInvoiceModal = () => {
    setSendInvoiceBooking(null)
    setSendInvoiceMobile('')
  }

  const handleSendInvoiceWhatsApp = async () => {
    if (!sendInvoiceBooking) return
    const digits = sendInvoiceMobile.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) {
      alert('Enter a valid 10-digit mobile number')
      return
    }
    setSendInvoiceSending(true)
    try {
      const res = await fetch(`/api/booking/${sendInvoiceBooking.id}/send-invoice-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: digits }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send invoice')
      }
      closeSendInvoiceModal()
      alert('Invoice sent on WhatsApp')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSendInvoiceSending(false)
    }
  }

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-primary-600">{booking.token}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              booking.status === 'COMPLETED'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {booking.status}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {format(new Date(booking.date), 'EEEE, MMMM d, yyyy')} at {formatTime12h(booking.timeSlot)}
          </div>
        </div>
        {booking.status === 'BOOKED' && (
          <button
            onClick={() => handleMarkCompleted(booking.id)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Mark Completed
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <User className="text-gray-400" size={18} />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{booking.user.name}</div>
            <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <a
                href={`tel:${booking.user.mobile}`}
                className="inline-flex items-center gap-1 text-primary-600 hover:underline"
              >
                <Phone size={14} />
                {booking.user.mobile}
              </a>
              <button
                type="button"
                onClick={() => handleCopyMobile(booking.user.mobile)}
                className="inline-flex items-center gap-1 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                title="Copy number"
              >
                <Copy size={14} />
              </button>
              {copiedMobile === booking.user.mobile && (
                <span className="text-xs text-green-600 font-medium">Copied!</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Services:</div>
          <div className="space-y-1">
            {booking.services.map((bs, idx) => (
              <div key={idx} className="text-sm text-gray-600 flex justify-between">
                <span>{bs.service.name}{(bs.quantity ?? 1) > 1 ? ` ×${bs.quantity}` : ''}</span>
                <span>{formatPrice(bs.price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-semibold">
            <span>Total:</span>
            <span className="text-primary-600">
              {formatPrice(booking.payment?.totalAmount ?? booking.services.reduce((sum, bs) => sum + bs.price, 0))}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Paid:</span>
            <span className="font-medium text-green-700">{formatPrice(booking.payment?.amountPaid ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Due:</span>
            <span className="font-medium text-amber-700">
              {formatPrice(Math.max(0, (booking.payment?.totalAmount ?? booking.services.reduce((s, bs) => s + bs.price, 0)) - (booking.payment?.amountPaid ?? 0)))}
            </span>
          </div>
          {(booking.payment?.onlineAmount !== undefined && booking.payment.onlineAmount > 0) && (
            <div className="text-xs text-gray-500">Online: {formatPrice(booking.payment.onlineAmount)}</div>
          )}
          {(booking.payment?.cashAmount !== undefined && booking.payment.cashAmount > 0) && (
            <div className="text-xs text-gray-500">Cash: {formatPrice(booking.payment.cashAmount)}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              booking.payment?.paymentStatus === 'COMPLETED'
                ? 'bg-green-100 text-green-800'
                : booking.payment?.paymentStatus === 'FREE'
                ? 'bg-blue-100 text-blue-800'
                : booking.payment?.paymentStatus === 'FAILED'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {booking.payment?.paymentStatus === 'FREE' ? 'Pay at Salon' : (booking.payment?.paymentStatus || 'PENDING')}
            </span>
            {booking.payment && (
              <>
                <button
                  type="button"
                  onClick={() => openAddCashModal(booking)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200"
                >
                  <Banknote size={14} />
                  Record cash
                </button>
                <button
                  type="button"
                  onClick={() => openEditPaymentModal(booking)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium hover:bg-gray-200"
                >
                  <Edit3 size={14} />
                  Edit payment
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => openEditServicesModal(booking)}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-medium hover:bg-purple-200"
              title="Add more services"
            >
              <Edit3 size={14} />
              Add services
            </button>
            <button
              type="button"
              onClick={() => window.open(`/booking/invoice?token=${encodeURIComponent(booking.token)}`, '_blank')}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium hover:bg-gray-200"
              title="Print invoice"
            >
              <Printer size={14} />
              Print invoice
            </button>
            {booking.payment?.paymentStatus === 'COMPLETED' && (
              <button
                type="button"
                onClick={() => openSendInvoiceModal(booking)}
                className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium hover:bg-emerald-100"
                title="Send invoice on WhatsApp"
              >
                <Send size={14} />
                Send invoice
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Staff Dashboard</h1>
            <p className="text-gray-600 mt-1">View and manage today&apos;s appointments</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-gray-500" />
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 min-w-[160px] text-sm"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="text-primary-600" size={24} />
            Today&apos;s Appointments ({todayBookings.length})
          </h2>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : todayBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-md">
              No appointments scheduled for today
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {todayBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>

        {upcomingBookings.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Upcoming Appointments ({upcomingBookings.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment modal: Record cash or Edit payment */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {paymentModal.mode === 'add_cash' ? 'Record cash payment' : 'Edit payment breakdown'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Booking {paymentModal.booking.token} — Total: {formatPrice(paymentModal.booking.payment?.totalAmount ?? paymentModal.booking.services.reduce((s, bs) => s + bs.price, 0))}
            </p>
            {paymentModal.mode === 'add_cash' ? (
              <>
                <p className="text-sm text-gray-700 mb-2">Amount already paid: {formatPrice(paymentModal.booking.payment?.amountPaid ?? 0)}</p>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash amount to add</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
                  placeholder="0"
                />
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Online amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editOnline}
                  onChange={(e) => setEditOnline(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editCash}
                  onChange={(e) => setEditCash(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closePaymentModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={paymentModal.mode === 'add_cash' ? handleRecordCash : handleSaveEditPayment}
                disabled={paymentSaving}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {paymentSaving ? 'Saving...' : paymentModal.mode === 'add_cash' ? 'Record cash' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Services modal */}
      {editServicesBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Add services</h3>
            <p className="text-sm text-gray-500 mb-4">
              Booking {editServicesBooking.token} — pick services to add on top of existing ones.
            </p>
            {servicesLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading services…</div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {availableServices.map((svc) => {
                  const qty = servicesQty[svc.id] ?? 0
                  return (
                    <div key={svc.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{svc.name}</div>
                        <div className="text-xs text-gray-400">{formatPrice(svc.price)} · {svc.duration} min</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setServicesQty((prev) => ({ ...prev, [svc.id]: Math.max(0, (prev[svc.id] ?? 0) - 1) }))}
                          disabled={qty === 0}
                          className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-bold text-base flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                        >−</button>
                        <span className="w-5 text-center text-sm font-medium">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setServicesQty((prev) => ({ ...prev, [svc.id]: (prev[svc.id] ?? 0) + 1 }))}
                          className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 font-bold text-base flex items-center justify-center hover:bg-primary-200"
                        >+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* Summary of selected */}
            {Object.values(servicesQty).some((q) => q > 0) && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                Adding:{' '}
                {Object.entries(servicesQty)
                  .filter(([, q]) => q > 0)
                  .map(([id, q]) => {
                    const s = availableServices.find((sv) => sv.id === id)
                    return s ? `${s.name}${q > 1 ? ` ×${q}` : ''}` : ''
                  })
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={closeEditServicesModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveServices}
                disabled={editServicesSaving || !Object.values(servicesQty).some((q) => q > 0)}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {editServicesSaving ? 'Saving…' : 'Add services'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendInvoiceBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Send invoice on WhatsApp</h3>
            <p className="text-sm text-gray-600 mb-4">
              Booking {sendInvoiceBooking.token} — sends the same receipt template as after payment. Change the number if needed.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile (10 digits)</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={sendInvoiceMobile}
              onChange={(e) => setSendInvoiceMobile(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-6"
              placeholder="9876543210"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeSendInvoiceModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvoiceWhatsApp}
                disabled={sendInvoiceSending}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {sendInvoiceSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
