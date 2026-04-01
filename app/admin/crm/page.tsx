'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Users,
  MessageSquare,
  Send,
  CheckSquare,
  Square,
  ChevronDown,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
} from 'lucide-react'
import { setUserRole } from '@/lib/auth'

interface Customer {
  id: string
  name: string
  mobile: string
  createdAt: string
  marketingConsent: boolean
  totalBookings: number
  lastBookingDate: string | null
  lastLocationName: string | null
  daysSinceLastBooking: number | null
}

interface Location {
  id: string
  name: string
}

type Filter = 'all' | 'recent' | 'lapsed' | 'new' | 'nobooking'
type Mode = 'template' | 'text'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All Customers',
  recent: 'Active (30d)',
  lapsed: 'Lapsed (60d+)',
  new: 'New (30d)',
  nobooking: 'Never Booked',
}

export default function CrmPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [locationId, setLocationId] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Composer
  const [mode, setMode] = useState<Mode>('template')
  const [templateName, setTemplateName] = useState('')
  const [templateParams, setTemplateParams] = useState('')
  const [templateLanguage, setTemplateLanguage] = useState('en')
  const [message, setMessage] = useState('')
  const [customMobiles, setCustomMobiles] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{
    sent: number
    failed: number
    total: number
    results: { mobile: string; ok: boolean; error?: string }[]
  } | null>(null)
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    setUserRole('ADMIN')
  }, [])

  // Fetch locations for filter
  useEffect(() => {
    fetch('/api/admin/locations')
      .then((r) => r.json())
      .then((d) => setLocations(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter, q: query })
      if (locationId) params.set('locationId', locationId)
      const res = await fetch(`/api/admin/crm/customers?${params}`)
      const data = await res.json()
      setCustomers(data.customers || [])
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [filter, locationId, query])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // Selection helpers
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === customers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(customers.map((c) => c.id)))
    }
  }

  const selectedCustomers = customers.filter((c) => selected.has(c.id))
  const selectedMobiles = selectedCustomers.map((c) => c.mobile)
  const namesMap: Record<string, string> = {}
  selectedCustomers.forEach((c) => {
    namesMap[c.mobile] = c.name
  })

  const handleSend = async () => {
    setSendError('')
    setSendResult(null)

    const parsedParams = templateParams
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const totalTargets =
      selectedMobiles.length +
      (customMobiles
        ? customMobiles
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 10).length
        : 0)

    if (totalTargets === 0) {
      setSendError('Select at least one customer or enter custom numbers.')
      return
    }

    if (mode === 'template' && !templateName.trim()) {
      setSendError('Enter the template name.')
      return
    }

    if (mode === 'text' && !message.trim()) {
      setSendError('Enter a message.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/admin/crm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          mobiles: selectedMobiles,
          customMobiles,
          templateName: templateName.trim(),
          templateParams: parsedParams,
          templateLanguage,
          message,
          names: namesMap,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Send failed')
      } else {
        setSendResult(data)
      }
    } catch {
      setSendError('Network error. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-charcoal-dark">
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-serif text-white text-2xl font-light tracking-wide">Customer CRM</h1>
            <p className="text-white/40 text-xs font-sans mt-1 tracking-wide">
              Send WhatsApp offers and messages to your customers
            </p>
          </div>
          <div className="flex items-center gap-2 text-white/30 text-xs font-sans">
            <Users size={14} />
            <span>{customers.length} customers</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left panel: Customer list */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-[10px] tracking-[0.2em] uppercase font-sans px-3 py-1.5 rounded-full border transition-colors ${
                  filter === f
                    ? 'bg-gold text-charcoal-dark border-gold'
                    : 'border-white/10 text-white/50 hover:text-white hover:border-white/20'
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Search + Location */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Search name or mobile..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-charcoal border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm font-sans placeholder:text-white/30 focus:outline-none focus:border-gold/40"
              />
            </div>
            <div className="relative">
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="appearance-none bg-charcoal border border-white/10 rounded-xl pl-3 pr-8 py-2.5 text-white/70 text-sm font-sans focus:outline-none focus:border-gold/40"
              >
                <option value="">All Locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          <div className="bg-charcoal border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <button type="button" onClick={toggleAll} className="text-white/40 hover:text-gold transition-colors">
                {selected.size === customers.length && customers.length > 0 ? (
                  <CheckSquare size={16} className="text-gold" />
                ) : (
                  <Square size={16} />
                )}
              </button>
              <span className="text-white/40 text-xs font-sans">
                {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/30">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm font-sans">Loading...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-white/30">
                <Users size={28} className="mb-3" />
                <p className="text-sm font-sans">No customers found</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      selected.has(c.id) ? 'bg-gold/5' : 'hover:bg-white/3'
                    }`}
                    onClick={() => toggleOne(c.id)}
                  >
                    <button
                      type="button"
                      className="shrink-0 text-white/40 hover:text-gold transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleOne(c.id)
                      }}
                    >
                      {selected.has(c.id) ? (
                        <CheckSquare size={16} className="text-gold" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-sans font-medium truncate">{c.name}</span>
                        {!c.marketingConsent && (
                          <span className="text-[9px] text-red-400/70 tracking-wider uppercase font-sans border border-red-400/20 rounded px-1">
                            opt-out
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone size={10} className="text-white/30" />
                        <span className="text-white/40 text-xs font-sans">{c.mobile}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-white/60 text-xs font-sans">
                        {c.totalBookings} booking{c.totalBookings !== 1 ? 's' : ''}
                      </div>
                      {c.lastBookingDate ? (
                        <div className="text-white/30 text-[10px] font-sans mt-0.5">
                          {c.daysSinceLastBooking === 0
                            ? 'Today'
                            : c.daysSinceLastBooking === 1
                            ? 'Yesterday'
                            : `${c.daysSinceLastBooking}d ago`}
                          {c.lastLocationName ? ` · ${c.lastLocationName}` : ''}
                        </div>
                      ) : (
                        <div className="text-white/20 text-[10px] font-sans mt-0.5">No bookings</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Composer */}
        <div className="lg:w-96 shrink-0">
          <div className="sticky top-20 bg-charcoal border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <MessageSquare size={16} className="text-gold" />
              <span className="text-white text-sm font-sans font-medium">Compose Message</span>
            </div>

            <div className="p-5 space-y-5">
              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                {(['template', 'text'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 text-[10px] tracking-[0.2em] uppercase font-sans transition-colors ${
                      mode === m
                        ? 'bg-gold text-charcoal-dark font-medium'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {m === 'template' ? 'Template' : 'Direct Text'}
                  </button>
                ))}
              </div>

              {mode === 'template' ? (
                <>
                  <div>
                    <label className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans block mb-1.5">
                      Template Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. salon_offer_v1"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full bg-charcoal-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-sans placeholder:text-white/20 focus:outline-none focus:border-gold/40"
                    />
                    <p className="text-white/25 text-[10px] font-sans mt-1">
                      Must match exact name in Meta Template Library
                    </p>
                  </div>

                  <div>
                    <label className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans block mb-1.5">
                      Body Params (one per line)
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"Value for {{1}}\nValue for {{2}}"}
                      value={templateParams}
                      onChange={(e) => setTemplateParams(e.target.value)}
                      className="w-full bg-charcoal-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-sans placeholder:text-white/20 focus:outline-none focus:border-gold/40 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans block mb-1.5">
                      Language Code
                    </label>
                    <input
                      type="text"
                      placeholder="en"
                      value={templateLanguage}
                      onChange={(e) => setTemplateLanguage(e.target.value)}
                      className="w-full bg-charcoal-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-sans placeholder:text-white/20 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans block mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={6}
                    placeholder={"Hi {name}, we have an exclusive offer just for you! 🌹\n\nBook now and get 20% off your next visit at Valessio Paris."}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-charcoal-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-sans placeholder:text-white/20 focus:outline-none focus:border-gold/40 resize-none"
                  />
                  <p className="text-white/25 text-[10px] font-sans mt-1">
                    Use <code className="text-gold/60 font-mono">{'{name}'}</code> to personalize. Note: free-text only works within 24h customer messaging window. For cold outreach use Template mode.
                  </p>
                </div>
              )}

              {/* Custom mobile numbers */}
              <div>
                <label className="text-white/40 text-[10px] tracking-[0.2em] uppercase font-sans block mb-1.5">
                  Additional Numbers
                </label>
                <textarea
                  rows={2}
                  placeholder={"9876543210\n9876543211"}
                  value={customMobiles}
                  onChange={(e) => setCustomMobiles(e.target.value)}
                  className="w-full bg-charcoal-dark border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-sans placeholder:text-white/20 focus:outline-none focus:border-gold/40 resize-none font-mono"
                />
                <p className="text-white/25 text-[10px] font-sans mt-1">
                  Numbers not in the customer list — one per line or comma-separated
                </p>
              </div>

              {/* Recipients summary */}
              <div className="bg-white/3 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-white/50 text-xs font-sans">Recipients</span>
                <span className="text-white text-sm font-sans font-medium">
                  {selected.size} selected
                  {customMobiles.trim() ? ` + custom` : ''}
                </span>
              </div>

              {/* Error */}
              {sendError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-xs font-sans">{sendError}</p>
                </div>
              )}

              {/* Result */}
              {sendResult && (
                <div className="bg-white/3 border border-white/5 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    <span className="text-white text-sm font-sans font-medium">
                      {sendResult.sent} sent · {sendResult.failed} failed
                    </span>
                  </div>
                  {sendResult.results.filter((r) => !r.ok).length > 0 && (
                    <div className="space-y-1">
                      {sendResult.results
                        .filter((r) => !r.ok)
                        .slice(0, 5)
                        .map((r) => (
                          <p key={r.mobile} className="text-red-400/70 text-[10px] font-sans">
                            {r.mobile}: {r.error}
                          </p>
                        ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSendResult(null)}
                    className="text-white/30 text-[10px] font-sans hover:text-white/60 flex items-center gap-1"
                  >
                    <X size={10} /> Clear
                  </button>
                </div>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed text-charcoal-dark font-sans font-medium text-[11px] tracking-[0.2em] uppercase py-3 rounded-full transition-colors"
              >
                {sending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send WhatsApp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
