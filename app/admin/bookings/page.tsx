'use client'

import { useState, useEffect } from 'react'
import { format, isToday, isPast, isFuture, startOfDay, parseISO, subDays } from 'date-fns'
import { CheckCircle, XCircle, Clock, Calendar, ChevronDown, ChevronUp, Phone, User, DollarSign, Banknote, Edit3, Download, Printer, Send } from 'lucide-react'
import { formatTime12h } from '@/lib/formatTime'
import { setUserRole } from '@/lib/auth'
import { useCurrency } from '@/lib/CurrencyContext'

interface Location {
  id: string
  name: string
  slug: string
  address: string | null
}

interface Booking {
  id: string
  token: string
  date: string
  timeSlot: string
  status: string
  notes?: string
  createdAt: string
  location?: { id: string; name: string; address: string | null } | null
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
    paymentType: string
    totalAmount: number
    amountPaid: number
    onlineAmount: number
    cashAmount: number
  } | null
}

type FilterType = 'all' | 'today' | 'upcoming' | 'previous' | 'dateRange'

export default function AdminBookingsPage() {
  const { formatPrice } = useCurrency()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const weekAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [dateFrom, setDateFrom] = useState(weekAgoStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([todayStr]))
  const [paymentModal, setPaymentModal] = useState<{
    booking: Booking
    mode: 'add_cash' | 'edit'
  } | null>(null)
  const [cashInput, setCashInput] = useState('')
  const [editOnline, setEditOnline] = useState('')
  const [editCash, setEditCash] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [sendInvoiceBooking, setSendInvoiceBooking] = useState<Booking | null>(null)
  const [sendInvoiceMobile, setSendInvoiceMobile] = useState('')
  const [sendInvoiceSending, setSendInvoiceSending] = useState(false)

  useEffect(() => {
    setUserRole('ADMIN')
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
        ? `/api/admin/bookings?locationId=${encodeURIComponent(selectedLocationId)}`
        : '/api/admin/bookings'
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch bookings')
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        setBookings(data)
        const todayFmt = format(new Date(), 'yyyy-MM-dd')
        setExpandedDates(new Set([todayFmt]))
      } else {
        setBookings([])
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="text-green-600" size={20} />
      case 'CANCELLED':
        return <XCircle className="text-red-600" size={20} />
      default:
        return <Clock className="text-blue-600" size={20} />
    }
  }

  // Group bookings by date
  const groupBookingsByDate = (bookings: Booking[]) => {
    const grouped: Record<string, Booking[]> = {}
    bookings.forEach((booking) => {
      const dateKey = format(new Date(booking.date), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(booking)
    })
    return grouped
  }

  // Filter bookings based on selected filter
  const getFilteredBookings = () => {
    switch (filter) {
      case 'today':
        return bookings.filter((b) => isToday(new Date(b.date)))
      case 'upcoming':
        return bookings.filter((b) => isFuture(startOfDay(new Date(b.date))))
      case 'previous':
        return bookings.filter((b) => isPast(startOfDay(new Date(b.date))) && !isToday(new Date(b.date)))
      case 'dateRange': {
        let from = startOfDay(parseISO(dateFrom))
        let to = startOfDay(parseISO(dateTo))
        if (from > to) [from, to] = [to, from]
        return bookings.filter((b) => {
          const d = startOfDay(new Date(b.date))
          return d >= from && d <= to
        })
      }
      default:
        return bookings
    }
  }

  const dateRangeBookingsCount = (() => {
    let from = startOfDay(parseISO(dateFrom))
    let to = startOfDay(parseISO(dateTo))
    if (from > to) [from, to] = [to, from]
    return bookings.filter((b) => {
      const d = startOfDay(new Date(b.date))
      return d >= from && d <= to
    }).length
  })()

  const downloadFilteredBookings = () => {
    if (filteredBookings.length === 0) return
    const rows = filteredBookings.map((b) => {
      const total = b.payment?.totalAmount ?? b.services.reduce((s, bs) => s + bs.price, 0)
      const paid = b.payment?.amountPaid ?? 0
      const services = b.services.map((bs) => `${bs.service.name} (${formatPrice(bs.price)})`).join('; ')
      return {
        Date: format(new Date(b.date), 'yyyy-MM-dd'),
        Time: formatTime12h(b.timeSlot),
        Token: b.token,
        Customer: b.user.name,
        Mobile: b.user.mobile,
        Location: b.location?.name ?? '',
        Services: services,
        Total: total,
        Paid: paid,
        Due: Math.max(0, total - paid),
        Status: b.status,
        PaymentStatus: b.payment?.paymentStatus ?? '',
      }
    })
    const headers = Object.keys(rows[0] || {})
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const suffix = filter === 'dateRange' ? `${dateFrom}-to-${dateTo}` : filter
    link.download = `bookings-${suffix}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // Toggle date expansion
  const toggleDate = (dateKey: string) => {
    const newExpanded = new Set(expandedDates)
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey)
    } else {
      newExpanded.add(dateKey)
    }
    setExpandedDates(newExpanded)
  }

  const filteredBookings = getFilteredBookings()
  const groupedBookings = groupBookingsByDate(filteredBookings)
  const sortedDates = Object.keys(groupedBookings).sort((a, b) => {
    // Sort dates: today first, then future dates ascending, then past dates descending
    const dateA = new Date(a)
    const dateB = new Date(b)
    const today = startOfDay(new Date())
    
    if (isToday(dateA)) return -1
    if (isToday(dateB)) return 1
    
    if (isFuture(dateA) && isFuture(dateB)) return dateA.getTime() - dateB.getTime()
    if (isPast(dateA) && isPast(dateB)) return dateB.getTime() - dateA.getTime()
    
    return isFuture(dateA) ? -1 : 1
  })

  const getTotalForDate = (dateBookings: Booking[]) => {
    return dateBookings.reduce((sum, b) => {
      return sum + b.services.reduce((s, bs) => s + bs.price, 0)
    }, 0)
  }

  const getBookingCountForDate = (dateBookings: Booking[]) => {
    return dateBookings.filter(b => b.status !== 'CANCELLED').length
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
              <p className="text-gray-600 mt-1">View and manage appointments by location</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">Location</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">Total: {bookings.length}</span>
              <button
                type="button"
                onClick={downloadFilteredBookings}
                disabled={filteredBookings.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Download size={18} />
                Download ({filteredBookings.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Bookings</div>
            <div className="text-2xl font-bold text-gray-900">{bookings.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Today&apos;s Bookings</div>
            <div className="text-2xl font-bold text-primary-600">
              {bookings.filter(b => isToday(new Date(b.date))).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Upcoming</div>
            <div className="text-2xl font-bold text-blue-600">
              {bookings.filter(b => isFuture(startOfDay(new Date(b.date)))).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(bookings.reduce((sum, b) => {
                return sum + b.services.reduce((s, bs) => s + bs.price, 0)
              }, 0))}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-4 font-medium text-sm transition-colors ${
                filter === 'all'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Bookings ({bookings.length})
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-6 py-4 font-medium text-sm transition-colors ${
                filter === 'today'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Today ({bookings.filter(b => isToday(new Date(b.date))).length})
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-6 py-4 font-medium text-sm transition-colors ${
                filter === 'upcoming'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upcoming ({bookings.filter(b => isFuture(startOfDay(new Date(b.date)))).length})
            </button>
            <button
              onClick={() => setFilter('previous')}
              className={`px-6 py-4 font-medium text-sm transition-colors ${
                filter === 'previous'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Previous ({bookings.filter(b => isPast(startOfDay(new Date(b.date))) && !isToday(new Date(b.date))).length})
            </button>
            <button
              onClick={() => setFilter('dateRange')}
              className={`px-6 py-4 font-medium text-sm transition-colors ${
                filter === 'dateRange'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Date range ({dateRangeBookingsCount})
            </button>
          </div>
          {filter === 'dateRange' && (
            <div className="px-6 py-4 flex flex-wrap items-center gap-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <p className="text-sm text-gray-500">
                Showing {filteredBookings.length} bookings from {dateFrom} to {dateTo}
              </p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading bookings...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-600 text-lg">No bookings found</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
            {sortedDates.map((dateKey) => {
              const dateBookings = groupedBookings[dateKey]
              const date = new Date(dateKey)
              const isExpanded = expandedDates.has(dateKey)
              const isDateToday = isToday(date)
              const totalAmount = getTotalForDate(dateBookings)
              const bookingCount = getBookingCountForDate(dateBookings)

              return (
                <div key={dateKey} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {/* Date Header */}
                  <button
                    onClick={() => toggleDate(dateKey)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className={`${isDateToday ? 'text-primary-600' : 'text-gray-400'}`} size={24} />
                      <div className="text-left">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {format(date, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          {isDateToday && (
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {bookingCount} booking{bookingCount !== 1 ? 's' : ''} • Total: {formatPrice(totalAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="text-gray-400" size={20} />
                      ) : (
                        <ChevronDown className="text-gray-400" size={20} />
                      )}
                    </div>
                  </button>

                  {/* Bookings List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <div className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
                        {dateBookings
                          .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
                          .map((booking) => {
                            const bookingTotal = booking.services.reduce((sum, bs) => sum + bs.price, 0)
                            return (
                              <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                  {/* Time & Token */}
                                  <div className="lg:col-span-2">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Clock className="text-gray-400" size={18} />
                                      <span className="font-semibold text-lg">{formatTime12h(booking.timeSlot)}</span>
                                    </div>
                                    <div className="font-mono text-sm text-gray-500">{booking.token}</div>
                                  </div>

                                  {/* Customer Info */}
                                  <div className="lg:col-span-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <User className="text-gray-400" size={18} />
                                      <span className="font-medium text-gray-900">{booking.user.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <Phone size={14} />
                                      {booking.user.mobile}
                                    </div>
                                  </div>

                                  {/* Services */}
                                  <div className="lg:col-span-3">
                                    <div className="text-sm text-gray-600 mb-1">Services:</div>
                                    <div className="space-y-1">
                                      {booking.services.map((bs, idx) => (
                                        <div key={idx} className="flex justify-between text-sm">
                                          <span className="text-gray-700">{bs.service.name}{(bs.quantity ?? 1) > 1 ? ` ×${bs.quantity}` : ''}</span>
                                          <span className="text-gray-600">{formatPrice(bs.price)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Amount & Payment */}
                                  <div className="lg:col-span-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <DollarSign className="text-gray-400" size={18} />
                                      <span className="font-semibold text-lg">{formatPrice(booking.payment?.totalAmount ?? bookingTotal)}</span>
                                    </div>
                                    <div className="text-sm space-y-1 mb-2">
                                      <div className="flex justify-between text-gray-700">
                                        <span>Paid:</span>
                                        <span className="font-medium text-green-700">{formatPrice(booking.payment?.amountPaid ?? 0)}</span>
                                      </div>
                                      <div className="flex justify-between text-gray-700">
                                        <span>Due:</span>
                                        <span className="font-medium text-amber-700">{formatPrice(Math.max(0, (booking.payment?.totalAmount ?? bookingTotal) - (booking.payment?.amountPaid ?? 0)))}</span>
                                      </div>
                                      {(booking.payment?.onlineAmount !== undefined && booking.payment?.onlineAmount > 0) && (
                                        <div className="text-xs text-gray-500">Online: {formatPrice(booking.payment.onlineAmount)}</div>
                                      )}
                                      {(booking.payment?.cashAmount !== undefined && booking.payment?.cashAmount > 0) && (
                                        <div className="text-xs text-gray-500">Cash: {formatPrice(booking.payment.cashAmount)}</div>
                                      )}
                                    </div>
                                    <div className="mb-2">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        booking.payment?.paymentStatus === 'COMPLETED'
                                          ? 'bg-green-100 text-green-800'
                                          : booking.payment?.paymentStatus === 'FAILED'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {booking.payment?.paymentStatus || 'PENDING'}
                                      </span>
                                    </div>
                                    {booking.payment?.paymentType && (
                                      <div className="text-xs text-gray-500 mb-2">
                                        {booking.payment.paymentType === 'ADVANCE' ? 'Advance' : 'Full'} Payment
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-2">
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
                                        onClick={() => window.open(`/booking/invoice?token=${encodeURIComponent(booking.token)}`, '_blank')}
                                        className="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium hover:bg-gray-200"
                                        title="Print invoice"
                                      >
                                        <Printer size={14} />
                                        Print invoice
                                      </button>
                                    </div>
                                  </div>

                                  {/* Status */}
                                  <div className="lg:col-span-1">
                                    <div className="flex items-center gap-2">
                                      {getStatusIcon(booking.status)}
                                      <span className="text-sm text-gray-700">{booking.status}</span>
                                    </div>
                                    {booking.notes && (
                                      <div className="mt-2 text-xs text-gray-500 italic">
                                        Note: {booking.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash amount to add ()</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="0"
                />
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1">Online amount ()</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editOnline}
                  onChange={(e) => setEditOnline(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash amount ()</label>
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
