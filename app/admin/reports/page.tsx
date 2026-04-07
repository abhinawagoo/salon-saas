'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Calendar, DollarSign, MapPin, Download } from 'lucide-react'
import { setUserRole } from '@/lib/auth'
import { useCurrency } from '@/lib/CurrencyContext'
import { format, parseISO, subDays } from 'date-fns'
import { formatTime12h } from '@/lib/formatTime'

interface Location {
  id: string
  name: string
}

interface ReportData {
  period: string
  dateFrom: string
  dateTo: string
  locationId: string | null
  summary: { totalBookings: number; totalRevenue: number }
  byLocation?: { locationId: string; locationName: string; totalBookings: number; totalRevenue: number }[]
  bookings: {
    id: string
    token: string
    date: string
    timeSlot: string
    status: string
    locationName?: string
    customerName: string
    customerMobile: string
    totalAmount: number
    amountPaid: number
    paymentStatus: string
  }[]
}

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'dateRange'

export default function AdminReportsPage() {
  const { formatPrice } = useCurrency()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const weekAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [period, setPeriod] = useState<PeriodType>('day')
  const [date, setDate] = useState(todayStr)
  const [dateFrom, setDateFrom] = useState(weekAgoStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUserRole('ADMIN')
    fetch('/api/admin/locations')
      .then((r) => r.json())
      .then((data) => setLocations(Array.isArray(data) ? data : []))
      .catch(() => [])
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (selectedLocationId) params.set('locationId', selectedLocationId)
    if (period === 'dateRange') {
      params.set('fromDate', dateFrom)
      params.set('toDate', dateTo)
    } else {
      params.set('period', period)
      params.set('date', date)
    }
    fetch(`/api/admin/reports?${params}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data && typeof data.summary === 'object' && Array.isArray(data.bookings)) {
          setReport(data as ReportData)
          setError(null)
        } else {
          setReport(null)
          setError(data?.error || 'Could not load report')
        }
      })
      .catch((err) => {
        setReport(null)
        setError(err?.message || 'Could not load report')
      })
      .finally(() => setLoading(false))
  }, [selectedLocationId, period, date, dateFrom, dateTo])

  const periodLabel = period === 'day' ? 'Day' : period === 'week' ? 'Week' : period === 'month' ? 'Month' : period === 'year' ? 'Year' : 'Date range'
  const reportDateFrom = report?.dateFrom ? format(parseISO(report.dateFrom), 'd MMM yyyy') : ''
  const reportDateTo = report?.dateTo ? format(parseISO(report.dateTo), 'd MMM yyyy') : ''
  const rangeLabel = reportDateFrom === reportDateTo ? reportDateFrom : `${reportDateFrom} – ${reportDateTo}`

  const downloadReport = () => {
    if (!report || report.bookings.length === 0) return
    const rows = report.bookings.map((b) => ({
      Date: b.date ? format(typeof b.date === 'string' ? parseISO(b.date) : new Date(b.date), 'yyyy-MM-dd') : '',
      Time: b.timeSlot,
      Token: b.token,
      Location: b.locationName ?? '',
      Customer: b.customerName,
      Mobile: b.customerMobile,
      Total: b.totalAmount,
      Paid: b.amountPaid,
      Status: b.status ?? '',
      PaymentStatus: b.paymentStatus ?? '',
    }))
    const headers = Object.keys(rows[0] || {})
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const suffix = period === 'dateRange' ? `${dateFrom}-to-${dateTo}` : `${period}-${date}`
    link.download = `report-${suffix}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales & Bill Report</h1>
                <p className="text-sm text-gray-500">View bookings and revenue by location and period</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 min-w-[180px]"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="dateRange">Date range</option>
            </select>
          </div>
          {period === 'dateRange' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {period === 'day' ? 'Date' : period === 'week' ? 'Week of' : period === 'month' ? 'Month' : 'Year'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          )}
          {report && (
            <button
              type="button"
              onClick={downloadReport}
              disabled={report.bookings.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Download size={18} />
              Download ({report.bookings.length})
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">Loading report...</div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 text-gray-600 mb-1">
                  <Calendar size={20} />
                  <span className="text-sm font-medium">Total Bookings</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{report.summary.totalBookings}</p>
                <p className="text-xs text-gray-500 mt-1">{periodLabel} wise · {rangeLabel}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 text-gray-600 mb-1">
                  <DollarSign size={20} />
                  <span className="text-sm font-medium">Total Revenue (Sales)</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(report.summary.totalRevenue)}</p>
                <p className="text-xs text-gray-500 mt-1">{periodLabel} wise · {rangeLabel}</p>
              </div>
            </div>

            {report.byLocation && report.byLocation.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <h2 className="px-6 py-4 border-b border-gray-200 font-semibold flex items-center gap-2">
                  <MapPin size={20} />
                  By location
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bookings</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {report.byLocation.map((row) => (
                        <tr key={row.locationId}>
                          <td className="px-6 py-4 font-medium text-gray-900">{row.locationName}</td>
                          <td className="px-6 py-4 text-right">{row.totalBookings}</td>
                          <td className="px-6 py-4 text-right font-medium">{formatPrice(row.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <h2 className="px-6 py-4 border-b border-gray-200 font-semibold flex items-center gap-2">
                <BarChart3 size={20} />
                Bookings in period
              </h2>
              {report.bookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No bookings in this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {report.bookings.map((b) => (
                        <tr key={b.id}>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                            {b.date ? format(typeof b.date === 'string' ? parseISO(b.date) : new Date(b.date), 'd MMM yyyy') : '–'} {formatTime12h(b.timeSlot)}
                          </td>
                          <td className="px-6 py-3 font-mono text-sm">{b.token}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{b.locationName ?? '–'}</td>
                          <td className="px-6 py-3 text-sm">{b.customerName} · {b.customerMobile}</td>
                          <td className="px-6 py-3 text-right font-medium">{formatPrice(b.amountPaid)}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${(b.paymentStatus || 'PENDING') === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {b.paymentStatus || 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500">{error || 'Could not load report.'}</p>
            <p className="text-sm text-gray-400 mt-2">Check the date range and try again.</p>
          </div>
        )}
      </div>
    </div>
  )
}
