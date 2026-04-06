'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  format, addDays, subDays, isToday, parseISO,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Clock, Phone,
  MapPin, Loader2, CalendarDays, AlertCircle, FileText,
  PanelLeftClose, PanelLeftOpen, Info,
} from 'lucide-react'
import Link from 'next/link'
import { setUserRole } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Location      { id: string; name: string; address: string | null }
interface Service       { id: string; name: string; price: number; duration: number }

interface CalBookingService {
  service: { id: string; name: string; duration: number; price: number }
  price: number
  quantity: number
}

interface CalBooking {
  id: string
  token: string
  date: string
  timeSlot: string
  durationMinutes: number
  status: string
  notes?: string | null
  locationId?: string | null
  user: { name: string; mobile: string }
  services: CalBookingService[]
  payment: {
    paymentStatus: string
    paymentType: string
    totalAmount: number
    amountPaid: number
    cashAmount: number
    onlineAmount: number
  } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_H      = 64   // px per 30-min slot
const COL_W       = 200  // min column width
const TIME_COL_W  = 68   // time labels column

const STATUS_STYLE: Record<string, { card: string; dot: string; badge: string; text: string }> = {
  BOOKED:    { card: 'bg-amber-50 border-amber-300 hover:border-amber-500',      dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800 border-amber-200',    text: 'text-amber-900' },
  COMPLETED: { card: 'bg-emerald-50 border-emerald-300 hover:border-emerald-500', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-900' },
  CANCELLED: { card: 'bg-gray-100 border-gray-200 opacity-50',                   dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500 border-gray-200',         text: 'text-gray-500' },
}

const PAYMENT_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  FREE:      'bg-blue-100 text-blue-700',
  PENDING:   'bg-orange-100 text-orange-700',
  FAILED:    'bg-red-100 text-red-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toMin     = (t: string) => { const [h,m] = t.split(':').map(Number); return (h||0)*60+(m||0) }
const toTimeStr = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
const fmt12     = (t: string) => { const [h,m] = t.split(':').map(Number); return `${(h||0)%12||12}:${String(m||0).padStart(2,'0')} ${(h||0)<12?'AM':'PM'}` }
const fmtINR    = (n: number) => new Intl.NumberFormat('en-IN',{ style:'currency',currency:'INR',maximumFractionDigits:0 }).format(n)

// ─── Overlap Layout ───────────────────────────────────────────────────────────
// Assigns each booking a left% and width% so overlapping bookings appear side-by-side.

function computeLayout(bookings: CalBooking[]): Map<string, { left: string; width: string }> {
  const layout = new Map<string, { left: string; width: string }>()
  if (bookings.length === 0) return layout

  const sorted = [...bookings].sort((a, b) => toMin(a.timeSlot) - toMin(b.timeSlot))

  // Step 1: Assign each booking to a virtual lane (like placing cards in columns)
  const laneEnds: number[] = []        // end-minute of last booking in each lane
  const bookingLane = new Map<string, number>()

  for (const b of sorted) {
    const start = toMin(b.timeSlot)
    const end   = start + Math.max(b.durationMinutes || 30, 30)
    let lane    = laneEnds.findIndex(t => t <= start)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end) }
    else laneEnds[lane] = end
    bookingLane.set(b.id, lane)
  }

  // Step 2: For each booking, find the highest lane index among all overlapping bookings.
  // That +1 gives us the total number of columns to divide space among.
  for (const b of sorted) {
    const start  = toMin(b.timeSlot)
    const end    = start + Math.max(b.durationMinutes || 30, 30)
    const myLane = bookingLane.get(b.id)!
    let maxLane  = myLane

    for (const other of sorted) {
      if (other.id === b.id) continue
      const os = toMin(other.timeSlot)
      const oe = os + Math.max(other.durationMinutes || 30, 30)
      if (start < oe && end > os) maxLane = Math.max(maxLane, bookingLane.get(other.id)!)
    }

    const cols     = maxLane + 1
    const wPct     = 100 / cols
    const lPct     = myLane * wPct
    layout.set(b.id, {
      left:  `calc(${lPct.toFixed(2)}% + 3px)`,
      width: `calc(${wPct.toFixed(2)}% - 6px)`,
    })
  }

  return layout
}

// ─── Mini Month Calendar ──────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onDateSelect,
  bookingCounts,
}: {
  selectedDate: Date
  onDateSelect: (d: Date) => void
  bookingCounts: Record<string, number>
}) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate))

  useEffect(() => {
    if (!isSameMonth(selectedDate, viewMonth)) setViewMonth(startOfMonth(selectedDate))
  }, [selectedDate]) // eslint-disable-line

  const days = eachDayOfInterval({
    start: startOfWeek(viewMonth,            { weekStartsOn: 1 }),
    end:   endOfWeek(endOfMonth(viewMonth),  { weekStartsOn: 1 }),
  })
  const weekDays = ['Mo','Tu','We','Th','Fr','Sa','Su']

  return (
    <div className="select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          onClick={() => setViewMonth(v => subMonths(v,1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-semibold text-gray-700">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth(v => addMonths(v,1))}
          className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-gray-400 uppercase py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const key       = format(day, 'yyyy-MM-dd')
          const count     = bookingCounts[key] || 0
          const isSelected= isSameDay(day, selectedDate)
          const inMonth   = isSameMonth(day, viewMonth)
          const today     = isToday(day)

          return (
            <button
              key={key}
              onClick={() => { onDateSelect(day); setViewMonth(startOfMonth(day)) }}
              className={[
                'relative flex flex-col items-center justify-center rounded-md h-7 text-[11px] font-medium transition-colors',
                isSelected
                  ? 'bg-gray-900 text-white'
                  : today
                    ? 'border border-amber-400 text-amber-700 bg-amber-50'
                    : inMonth
                      ? 'hover:bg-gray-100 text-gray-700'
                      : 'text-gray-300',
              ].join(' ')}
            >
              {format(day,'d')}
              {count > 0 && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Booking Block ────────────────────────────────────────────────────────────

function BookingBlock({
  booking, openMin, colLayout, onClick,
}: {
  booking: CalBooking
  openMin: number
  colLayout: { left: string; width: string }
  onClick: () => void
}) {
  const top    = (toMin(booking.timeSlot) - openMin) / 30 * SLOT_H
  const height = Math.max(booking.durationMinutes / 30 * SLOT_H, SLOT_H * 0.9)
  const s      = STATUS_STYLE[booking.status] ?? STATUS_STYLE.BOOKED

  return (
    <div
      className={`absolute rounded-lg border ${s.card} cursor-pointer overflow-hidden transition-all z-10 shadow-sm hover:shadow-md hover:z-20`}
      style={{ top, height, left: colLayout.left, width: colLayout.width }}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <div className="px-2 py-1.5 h-full flex flex-col gap-0.5 min-h-0">
        <div className="flex items-center gap-1 shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
          <span className="text-[10px] font-semibold text-gray-500 truncate">
            {fmt12(booking.timeSlot)}
            {booking.durationMinutes > 0 && ` · ${booking.durationMinutes}m`}
          </span>
        </div>
        <p className={`text-[11px] font-bold truncate shrink-0 leading-tight ${s.text}`}>
          {booking.user.name}
        </p>
        {height > SLOT_H * 1.1 && (
          <p className="text-[10px] text-gray-400 truncate leading-tight">
            {booking.services.map(bs => bs.service.name).join(', ') || '—'}
          </p>
        )}
        {height > SLOT_H * 1.8 && booking.payment && (
          <p className="text-[10px] font-semibold text-gray-500 mt-auto shrink-0">
            {fmtINR(booking.payment.totalAmount)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function DetailModal({
  booking,
  onClose,
  onStatusChange,
}: {
  booking: CalBooking
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const s = STATUS_STYLE[booking.status] ?? STATUS_STYLE.BOOKED

  const handleStatus = async (status: string) => {
    setSaving(true)
    await fetch(`/api/staff/booking/${booking.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    onStatusChange(booking.id, status)
    setSaving(false)
    onClose()
  }

  const due     = booking.payment ? Math.max(0, booking.payment.totalAmount - booking.payment.amountPaid) : 0
  const payBadge= PAYMENT_BADGE[booking.payment?.paymentStatus ?? ''] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={`px-5 py-4 border-b rounded-t-2xl flex items-start justify-between gap-3 shrink-0 ${booking.status === 'COMPLETED' ? 'bg-emerald-50' : booking.status === 'CANCELLED' ? 'bg-gray-50' : 'bg-amber-50/80'}`}>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {booking.status}
              </span>
              {booking.payment && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${payBadge}`}>
                  {booking.payment.paymentStatus}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 break-words">{booking.user.name}</h3>
            <a
              href={`tel:${booking.user.mobile}`}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-0.5 w-fit"
            >
              <Phone size={12} />
              {booking.user.mobile}
            </a>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 shrink-0 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Clock size={15} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {fmt12(booking.timeSlot)}
                <span className="text-gray-400 font-normal ml-1.5">
                  · {booking.durationMinutes || 0} min
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {format(parseISO(booking.date.slice(0,10)), 'EEEE, dd MMMM yyyy')}
              </p>
            </div>
          </div>

          {/* Services */}
          {booking.services.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Services</p>
              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {booking.services.map((bs, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{bs.service.name}</p>
                      <p className="text-xs text-gray-400">
                        {bs.service.duration} min{bs.quantity > 1 ? ` × ${bs.quantity}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 ml-3 shrink-0">{fmtINR(bs.price)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          {booking.payment && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Payment</p>
              <div className="rounded-xl border border-gray-100 overflow-hidden bg-gray-50/60">
                <div className="flex justify-between px-3 py-2 text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">{fmtINR(booking.payment.totalAmount)}</span>
                </div>
                {booking.payment.onlineAmount > 0 && (
                  <div className="flex justify-between px-3 py-2 text-sm border-t border-gray-100">
                    <span className="text-gray-500">Online</span>
                    <span className="font-medium text-gray-700">{fmtINR(booking.payment.onlineAmount)}</span>
                  </div>
                )}
                {booking.payment.cashAmount > 0 && (
                  <div className="flex justify-between px-3 py-2 text-sm border-t border-gray-100">
                    <span className="text-gray-500">Cash</span>
                    <span className="font-medium text-gray-700">{fmtINR(booking.payment.cashAmount)}</span>
                  </div>
                )}
                {due > 0 && (
                  <div className="flex justify-between px-3 py-2 text-sm border-t border-orange-100 bg-orange-50">
                    <span className="text-orange-600 font-semibold">Balance Due</span>
                    <span className="font-bold text-orange-700">{fmtINR(due)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Note</p>
              <p className="text-sm text-blue-800">{booking.notes}</p>
            </div>
          )}

          {/* Token */}
          <p className="text-[10px] text-gray-300 font-mono">Ref: {booking.token}</p>
        </div>

        {/* ── Footer actions ── */}
        <div className="px-5 py-4 border-t shrink-0 space-y-2">
          {/* Invoice link */}
          <a
            href={`/booking/invoice?token=${booking.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <FileText size={14} />
            View Invoice
          </a>

          {/* Status actions */}
          {booking.status === 'BOOKED' && (
            <div className="flex gap-2">
              <button
                onClick={() => handleStatus('COMPLETED')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Mark Complete
              </button>
              <button
                onClick={() => handleStatus('CANCELLED')}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-200 text-red-600 text-sm font-medium rounded-xl hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          )}
          {booking.status === 'COMPLETED' && (
            <p className="text-center text-xs text-emerald-600 font-semibold py-1">✓ This booking is completed</p>
          )}
          {booking.status === 'CANCELLED' && (
            <p className="text-center text-xs text-gray-400 py-1">This booking was cancelled</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Create Booking Modal ─────────────────────────────────────────────────────

function CreateModal({
  initialDate, initialTimeSlot,
  services, locations, defaultLocationId,
  onClose, onCreate,
}: {
  initialDate: string; initialTimeSlot: string
  services: Service[]; locations: Location[]; defaultLocationId: string
  onClose: () => void; onCreate: (b: CalBooking) => void
}) {
  const [form, setForm] = useState({
    customerName: '', customerMobile: '',
    date: initialDate, timeSlot: initialTimeSlot,
    locationId: defaultLocationId, notes: '',
  })
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((s, x) => s + x.duration, 0)
  const totalPrice    = selectedServices.reduce((s, x) => s + x.price, 0)

  const timeOptions: string[] = []
  for (let m = 6*60; m < 22*60; m += 30) timeOptions.push(toTimeStr(m))

  const toggleService = (id: string) =>
    setSelectedServiceIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.customerName.trim())  { setError('Customer name is required'); return }
    if (!form.customerMobile.trim()){ setError('Mobile number is required'); return }
    if (!form.locationId)           { setError('Location is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/calendar/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName:   form.customerName,
          customerMobile: form.customerMobile,
          date:           form.date,
          timeSlot:       form.timeSlot,
          locationId:     form.locationId,
          serviceIds:     selectedServiceIds,
          notes:          form.notes,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return }
      onCreate(await res.json())
      onClose()
    } catch { setError('Something went wrong. Please try again.') }
    finally   { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-bold text-gray-900">New Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <AlertCircle size={15} />{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Customer Name *</label>
              <input type="text" value={form.customerName} onChange={e=>set('customerName',e.target.value)} placeholder="Full name" required
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mobile *</label>
              <input type="tel" value={form.customerMobile} onChange={e=>set('customerMobile',e.target.value)} placeholder="Mobile number" required
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} required
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Time *</label>
              <select value={form.timeSlot} onChange={e=>set('timeSlot',e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
                {timeOptions.map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Location *</label>
            <select value={form.locationId} onChange={e=>set('locationId',e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Services</label>
              {selectedServices.length > 0 && (
                <span className="text-xs text-amber-700 font-semibold">
                  {totalDuration} min · {fmtINR(totalPrice)}
                </span>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {services.length === 0
                ? <p className="px-4 py-3 text-sm text-gray-400">No services available</p>
                : services.map(s => {
                  const sel = selectedServiceIds.includes(s.id)
                  return (
                    <label key={s.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${sel ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={sel} onChange={()=>toggleService(s.id)} className="accent-amber-500 w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.duration} min</p>
                      </div>
                      <p className="text-sm text-gray-600 font-medium shrink-0">{fmtINR(s.price)}</p>
                    </label>
                  )
                })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
            <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Special requests or notes…" rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
        </form>

        <div className="px-6 py-4 border-t shrink-0 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create Booking
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [locations, setLocations]   = useState<Location[]>([])
  const [bookings, setBookings]     = useState<CalBooking[]>([])
  const [services, setServices]     = useState<Service[]>([])
  const [loading, setLoading]       = useState(true)
  const [openTime, setOpenTime]     = useState('09:00')
  const [closeTime, setCloseTime]   = useState('21:00')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Month booking counts (for mini-calendar dots)
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({})
  const [countsMonth, setCountsMonth] = useState('')   // "YYYY-MM" of last fetch

  const [detailBooking, setDetailBooking] = useState<CalBooking | null>(null)
  const [createSlot, setCreateSlot]       = useState<{ date: string; timeSlot: string } | null>(null)

  const dateStr = format(selectedDate, 'yyyy-MM-dd')

  useEffect(() => { setUserRole('ADMIN') }, [])

  // ── Static data ──
  useEffect(() => {
    Promise.all([
      fetch('/api/locations').then(r => r.json()),
      fetch('/api/services').then(r => r.json()),
    ]).then(([locs, svcs]) => {
      const locArr: Location[] = Array.isArray(locs) ? locs : []
      setLocations(locArr)
      if (locArr.length > 0) setSelectedLocationId(locArr[0].id)
      setServices(Array.isArray(svcs) ? svcs.filter((s: Service & { isActive?: boolean }) => s.isActive !== false) : [])
    }).catch(() => {})
  }, [])

  // ── Bookings for selected date ──
  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ date: dateStr })
    if (selectedLocationId) p.set('locationId', selectedLocationId)
    fetch(`/api/admin/calendar?${p}`)
      .then(r => r.json())
      .then(data => {
        setBookings(Array.isArray(data.bookings) ? data.bookings : [])
        if (data.businessHours) {
          setOpenTime(data.businessHours.openTime  || '09:00')
          setCloseTime(data.businessHours.closeTime || '21:00')
        }
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false))
  }, [dateStr, selectedLocationId])

  // ── Month booking counts for mini-calendar dots ──
  useEffect(() => {
    const ym = format(selectedDate, 'yyyy-MM')
    if (ym === countsMonth) return
    setCountsMonth(ym)
    const p = new URLSearchParams({
      year:  String(selectedDate.getFullYear()),
      month: String(selectedDate.getMonth() + 1),
    })
    if (selectedLocationId) p.set('locationId', selectedLocationId)
    fetch(`/api/admin/calendar/month?${p}`)
      .then(r => r.json())
      .then(d => setMonthCounts(typeof d === 'object' ? d : {}))
      .catch(() => {})
  }, [selectedDate, selectedLocationId, countsMonth])

  // ── Grid config ──
  const openMin  = toMin(openTime)
  const closeMin = toMin(closeTime)
  const totalSlots = Math.max((closeMin - openMin) / 30, 2)
  const gridHeight = totalSlots * SLOT_H

  const timeSlots: string[] = []
  for (let m = openMin; m < closeMin; m += 30) timeSlots.push(toTimeStr(m))

  const handleColClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const slotMin = openMin + Math.floor(y / SLOT_H) * 30
    if (slotMin >= closeMin) return
    setCreateSlot({ date: dateStr, timeSlot: toTimeStr(slotMin) })
  }, [openMin, closeMin, dateStr])

  const updateBooking = useCallback((id: string, patch: Partial<CalBooking>) =>
    setBookings(p => p.map(b => b.id === id ? { ...b, ...patch } : b)), [])

  const addBooking = useCallback((b: CalBooking) => setBookings(p => [...p, b]), [])

  const booked    = bookings.filter(b => b.status === 'BOOKED').length
  const completed = bookings.filter(b => b.status === 'COMPLETED').length
  const cancelled = bookings.filter(b => b.status === 'CANCELLED').length

  // ── Compute overlap layout so concurrent bookings appear side-by-side ──
  const bookingLayout = useMemo(() => computeLayout(bookings), [bookings])

  // ── Auto-scroll to current time (or first booking) after load ──
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (loading || !scrollRef.current) return
    const now = new Date()
    const targetMin = isToday(selectedDate)
      ? now.getHours() * 60 + now.getMinutes()
      : (bookings.length > 0
          ? Math.min(...bookings.filter(b => b.status !== 'CANCELLED').map(b => toMin(b.timeSlot)))
          : openMin)
    const scrollTop = Math.max(0, (targetMin - openMin) / 30 * SLOT_H - 120)
    scrollRef.current.scrollTop = scrollTop
  }, [loading]) // eslint-disable-line

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-0'} transition-all duration-200 overflow-hidden shrink-0 bg-white border-r flex flex-col`}>
        <div className="flex-1 overflow-y-auto">

          {/* Back link + title */}
          <div className="px-4 pt-4 pb-3 border-b">
            <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← Back to Admin
            </Link>
            <h2 className="text-sm font-bold text-gray-800 mt-2">Booking Calendar</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Staff & Admin view</p>
          </div>

          {/* Mini month calendar */}
          <div className="px-3 py-3 border-b">
            <MiniCalendar
              selectedDate={selectedDate}
              onDateSelect={d => { setSelectedDate(d); setCountsMonth('') }}
              bookingCounts={monthCounts}
            />
          </div>

          {/* Location selector */}
          <div className="px-4 py-3 border-b">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <MapPin size={10} /> Location
            </p>
            <select
              value={selectedLocationId}
              onChange={e => { setSelectedLocationId(e.target.value); setCountsMonth('') }}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="">All Locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-b">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Legend</p>
            <div className="space-y-2">
              {[
                { dot: 'bg-amber-500',   label: 'Booked',    desc: 'Confirmed, upcoming' },
                { dot: 'bg-emerald-500', label: 'Completed', desc: 'Service done' },
                { dot: 'bg-gray-400',    label: 'Cancelled', desc: 'Booking cancelled' },
              ].map(({ dot, label, desc }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dot} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 leading-tight">{label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Payment badges */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">PAID</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">FREE</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">PENDING</span>
            </div>
            <p className="text-[9px] text-gray-300 mt-1">Payment status shown in booking detail</p>
          </div>

          {/* Instructions */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info size={10} /> How to use
            </p>
            <ul className="space-y-2 text-[11px] text-gray-500 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0">·</span>
                <span><b className="text-gray-600">Click empty slot</b> to create a new booking at that time</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0">·</span>
                <span><b className="text-gray-600">Click a booking block</b> to view full details, assign staff, or change status</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0">·</span>
                <span>Dots on calendar dates indicate bookings exist that day</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold mt-0.5 shrink-0">·</span>
                <span>All bookings (from app, admin, staff) appear here automatically</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Today's summary */}
        {isToday(selectedDate) && (
          <div className="px-4 py-3 border-t bg-gray-50 shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Today</p>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { n: booked,    label: 'Booked',    c: 'text-amber-600'   },
                { n: completed, label: 'Done',       c: 'text-emerald-600' },
                { n: cancelled, label: 'Cancelled',  c: 'text-gray-400'   },
              ].map(({ n, label, c }) => (
                <div key={label}>
                  <p className={`text-lg font-bold ${c}`}>{n}</p>
                  <p className="text-[9px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ════════════════ MAIN ════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Toolbar ── */}
        <div className="shrink-0 bg-white border-b px-3 sm:px-4 py-2.5 flex items-center gap-2 flex-wrap">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          {/* Date navigation */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button onClick={() => setSelectedDate(d => subDays(d,1))} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 transition-all">
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <CalendarDays size={13} className="text-gray-400" />
              <input
                type="date" value={dateStr}
                onChange={e => setSelectedDate(parseISO(e.target.value))}
                className="text-sm font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer w-[126px]"
              />
            </div>
            <button onClick={() => setSelectedDate(d => addDays(d,1))} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-gray-600 transition-all">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Today badge */}
          {isToday(selectedDate)
            ? <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">Today</span>
            : <button onClick={() => setSelectedDate(new Date())} className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors">Today</button>
          }

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Booking counts */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 border border-gray-100 rounded-lg px-3 py-1.5 bg-white">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{booked} booked</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />{completed} done</span>
              </div>
            )}

            {/* New booking */}
            <button
              onClick={() => setCreateSlot({ date: dateStr, timeSlot: toTimeStr(openMin) })}
              className="flex items-center gap-1.5 text-sm font-medium bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Booking</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* ── Calendar grid ── */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div className="inline-flex flex-col" style={{ minWidth: '100%' }}>

            {/* Header — sticky top */}
            <div className="flex sticky top-0 z-20 bg-white border-b shadow-sm">
              <div className="shrink-0 sticky left-0 z-30 bg-white border-r flex items-center justify-center"
                style={{ width: TIME_COL_W }}>
                <span className="text-[9px] text-gray-300 uppercase tracking-widest font-bold">Time</span>
              </div>
              <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <CalendarDays size={15} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {format(selectedDate, 'EEEE, d MMMM')}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {bookings.filter(b => b.status !== 'CANCELLED').length} booking{bookings.filter(b => b.status !== 'CANCELLED').length !== 1 ? 's' : ''}
                    {cancelled > 0 ? ` · ${cancelled} cancelled` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <div className="flex items-center justify-center py-24 text-gray-400">
                <Loader2 size={26} className="animate-spin mr-3" />
                <span className="text-sm">Loading bookings…</span>
              </div>
            ) : (
              <div className="flex">
                {/* Time labels — sticky left */}
                <div className="shrink-0 sticky left-0 z-10 bg-gray-50/95 backdrop-blur-sm border-r border-gray-100"
                  style={{ width: TIME_COL_W }}>
                  {timeSlots.map(slot => (
                    <div key={slot} className="flex items-start justify-end pr-2.5 border-b border-gray-100"
                      style={{ height: SLOT_H }}>
                      {toMin(slot) % 60 === 0
                        ? <span className="text-[11px] font-semibold text-gray-500 pt-1 tabular-nums">{fmt12(slot)}</span>
                        : <span className="text-[9px] text-gray-300 pt-1.5 tabular-nums">{fmt12(slot)}</span>
                      }
                    </div>
                  ))}
                </div>

                {/* Bookings column */}
                <div
                  className="relative flex-1 cursor-crosshair"
                  style={{ minWidth: COL_W * 2, height: gridHeight }}
                  onClick={handleColClick}
                >
                  {/* Grid lines */}
                  {timeSlots.map((slot, i) => (
                    <div key={slot}
                      className={`absolute left-0 right-0 pointer-events-none ${toMin(slot) % 60 === 0 ? 'border-b border-gray-100' : 'border-b border-dashed border-gray-50'}`}
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    />
                  ))}

                  {/* Click-to-create hover hint */}
                  <div className="absolute inset-0 hover:bg-amber-50/20 transition-colors pointer-events-none" />

                  {/* Booking blocks */}
                  {bookings.map(b => (
                    <BookingBlock
                      key={b.id}
                      booking={b}
                      openMin={openMin}
                      colLayout={bookingLayout.get(b.id) ?? { left: '3px', width: 'calc(100% - 6px)' }}
                      onClick={() => setDetailBooking(b)}
                    />
                  ))}

                  {/* Empty state */}
                  {bookings.length === 0 && !loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-sm text-gray-300 font-medium">No bookings for this day</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {detailBooking && (
        <DetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
          onStatusChange={(id, status) => {
            updateBooking(id, { status })
            setDetailBooking(null)
          }}
        />
      )}

      {createSlot && (
        <CreateModal
          initialDate={createSlot.date}
          initialTimeSlot={createSlot.timeSlot}
          services={services}
          locations={locations}
          defaultLocationId={selectedLocationId || locations[0]?.id || ''}
          onClose={() => setCreateSlot(null)}
          onCreate={b => {
            const bDate = format(new Date(b.date), 'yyyy-MM-dd')
            if (bDate === dateStr) addBooking(b)
          }}
        />
      )}
    </div>
  )
}
