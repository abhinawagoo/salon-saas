'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Plus, Edit2, Clock, CalendarX, Upload, X } from 'lucide-react'
import { setUserRole } from '@/lib/auth'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface BusinessHoursDay {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface Location {
  id: string
  name: string
  slug: string
  address: string | null
  mobile: string | null
  imageUrl: string | null
  isActive: boolean
  concurrentSlots?: number | null
  businessHoursJson?: string | null
  closedDatesJson?: string | null
  staffBookingNotifyPhones?: string | null
}

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Location | null>(null)
  const defaultBusinessHours: BusinessHoursDay[] = DAY_NAMES.map((_, i) => ({
    dayOfWeek: i,
    isOpen: i !== 0,
    openTime: '09:00',
    closeTime: '18:00',
  }))
  const [form, setForm] = useState({
    name: '',
    address: '',
    mobile: '',
    staffBookingNotifyPhones: '',
    imageUrl: '',
    concurrentSlots: 1,
    businessHours: defaultBusinessHours,
    closedDates: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    setUserRole('ADMIN')
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/admin/locations')
      const data = await res.json()
      setLocations(Array.isArray(data) ? data : [])
    } catch {
      setLocations([])
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditing(null)
    setForm({
      name: '',
      address: '',
      mobile: '',
      staffBookingNotifyPhones: '',
      imageUrl: '',
      concurrentSlots: 1,
      businessHours: defaultBusinessHours,
      closedDates: [],
    })
    setModal('add')
  }

  const openEdit = (loc: Location) => {
    setEditing(loc)
    let businessHours = defaultBusinessHours
    if (loc.businessHoursJson) {
      try {
        const arr = JSON.parse(loc.businessHoursJson)
        if (Array.isArray(arr)) {
          businessHours = DAY_NAMES.map((_, i) => {
            const found = arr.find((x: { dayOfWeek?: number }) => x?.dayOfWeek === i)
            return {
              dayOfWeek: i,
              isOpen: found?.isOpen ?? (i !== 0),
              openTime: found?.openTime ?? '09:00',
              closeTime: found?.closeTime ?? '18:00',
            }
          })
        }
      } catch {
        /* use default */
      }
    }
    let closedDates: string[] = []
    if (loc.closedDatesJson) {
      try {
        const arr = JSON.parse(loc.closedDatesJson)
        closedDates = Array.isArray(arr) ? arr.filter((d): d is string => typeof d === 'string') : []
      } catch {
        /* use empty */
      }
    }
    let staffNotifyText = ''
    if (loc.staffBookingNotifyPhones?.trim()) {
      try {
        const arr = JSON.parse(loc.staffBookingNotifyPhones) as unknown
        staffNotifyText = Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').join('\n') : ''
      } catch {
        staffNotifyText = loc.staffBookingNotifyPhones
      }
    }
    setForm({
      name: loc.name,
      address: loc.address || '',
      mobile: loc.mobile || '',
      staffBookingNotifyPhones: staffNotifyText,
      imageUrl: loc.imageUrl || '',
      concurrentSlots: loc.concurrentSlots ?? 1,
      businessHours,
      closedDates,
    })
    setModal('edit')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image (JPEG, PNG, WebP, or GIF).')
      return
    }
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('type', 'location')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setForm((f) => ({ ...f, imageUrl: data.url || '' }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = async () => {
    const url = form.imageUrl
    if (!url) return
    try {
      const res = await fetch('/api/admin/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.error || 'Failed to delete from storage. Please try again.')
        return
      }
      setForm((f) => ({ ...f, imageUrl: '' }))
    } catch {
      alert('Failed to delete from storage. Please try again.')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      alert('Location name is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name,
        address: form.address.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        staffBookingNotifyPhones: form.staffBookingNotifyPhones,
        imageUrl: form.imageUrl.trim() || undefined,
        concurrentSlots: form.concurrentSlots,
        businessHoursJson: JSON.stringify(form.businessHours),
        closedDatesJson: JSON.stringify(form.closedDates),
      }
      if (modal === 'add') {
        const res = await fetch('/api/admin/locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to add location')
      } else if (editing) {
        const res = await fetch(`/api/admin/locations/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            address: form.address.trim() || null,
            mobile: form.mobile.trim() || null,
            imageUrl: form.imageUrl.trim() || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update location')
      }
      setModal(null)
      fetchLocations()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canAddMore = true

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin/customize" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Back to Customize">
                <ArrowLeft size={20} />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Locations</h1>
                <p className="text-sm text-gray-500">Manage all your salon locations. Names appear in booking and invoices.</p>
              </div>
            </div>
            {canAddMore && (
              <button
                type="button"
                onClick={openAdd}
                className="bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 flex items-center gap-2 min-h-[44px]"
              >
                <Plus size={18} />
                Add location
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : locations.length === 0 ? (
            <div className="p-8 text-center">
              <MapPin className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 mb-4">No locations yet. Add your salon locations.</p>
              {canAddMore && (
                <button
                  onClick={openAdd}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700"
                >
                  Add first location
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {locations.map((loc) => (
                <li key={loc.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    {loc.imageUrl ? (
                      <img src={loc.imageUrl} alt={loc.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                        <MapPin className="text-primary-600" size={20} />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{loc.name}</p>
                      {loc.address && (
                        <p className="text-sm text-gray-500">{loc.address}</p>
                      )}
                      {loc.mobile && (
                        <p className="text-sm text-gray-500">📞 {loc.mobile}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openEdit(loc)}
                    className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto overscroll-contain">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl my-auto max-h-[90vh] flex flex-col min-h-0">
            <h2 className="text-xl font-semibold text-gray-900 px-6 pt-6 pb-2 shrink-0">
              {modal === 'add' ? 'Add location' : 'Edit location'}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Salon Downtown"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 123 Main St"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile no. (optional)</label>
                <input
                  type="tel"
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 9876543210"
                />
                <p className="text-xs text-gray-500 mt-1">Shown on bills for this branch.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Simultaneous Appointments</label>
                <p className="text-xs text-gray-500 mb-2">
                  Max clients served at the same time at this location. Set to 2 if you have 2 chairs/staff working in parallel, etc.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={form.concurrentSlots}
                    onChange={(e) => setForm((f) => ({ ...f, concurrentSlots: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))}
                    className="w-24 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  <span className="text-sm text-gray-500">client(s) at once</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff WhatsApp — booking alerts (optional)</label>
                <p className="text-xs text-gray-500 mb-2">
                  When someone books at <strong>this</strong> location only, we send your approved WhatsApp template to these numbers (customer name, mobile, date, time, services, amount). One 10-digit Indian mobile per line. Leave empty to use Staff/Admin users in the system instead.
                </p>
                <textarea
                  value={form.staffBookingNotifyPhones}
                  onChange={(e) => setForm((f) => ({ ...f, staffBookingNotifyPhones: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  placeholder={'9876543210\n9876543211'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
                <p className="text-xs text-gray-500 mb-2">This image appears on the bill for this location. JPEG, PNG or WebP. Max 10 MB.</p>
                <div className="flex flex-wrap items-start gap-4">
                  {form.imageUrl ? (
                    <div className="relative group">
                      <img
                        src={form.imageUrl}
                        alt="Location preview"
                        className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : null}
                  {!form.imageUrl && (
                    <label className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition-colors shrink-0">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
                      ) : (
                        <Upload size={24} className="text-gray-400" />
                      )}
                    </label>
                  )}
                  {form.imageUrl && (
                    <label className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition-colors shrink-0">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
                      ) : (
                        <span className="text-xs text-gray-500 text-center px-2">Replace</span>
                      )}
                    </label>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Clock size={16} />
                  Business Hours
                </h3>
                <p className="text-xs text-gray-500 mb-3">Set which days this salon is open. Closed days cannot be booked.</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {form.businessHours.map((day) => (
                    <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-2 p-2 rounded bg-gray-50">
                      <label className="flex items-center gap-2 min-w-[100px]">
                        <input
                          type="checkbox"
                          checked={day.isOpen}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              businessHours: f.businessHours.map((d) =>
                                d.dayOfWeek === day.dayOfWeek ? { ...d, isOpen: e.target.checked } : d
                              ),
                            }))
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">{DAY_NAMES[day.dayOfWeek]}</span>
                      </label>
                      {day.isOpen && (
                        <>
                          <input
                            type="time"
                            value={day.openTime}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                businessHours: f.businessHours.map((d) =>
                                  d.dayOfWeek === day.dayOfWeek ? { ...d, openTime: e.target.value } : d
                                ),
                              }))
                            }
                            className="px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                          <span className="text-gray-400">–</span>
                          <input
                            type="time"
                            value={day.closeTime}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                businessHours: f.businessHours.map((d) =>
                                  d.dayOfWeek === day.dayOfWeek ? { ...d, closeTime: e.target.value } : d
                                ),
                              }))
                            }
                            className="px-2 py-1 border border-gray-200 rounded text-sm"
                          />
                        </>
                      )}
                      {!day.isOpen && <span className="text-xs text-gray-500 italic">Closed</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <CalendarX size={16} />
                  Closed Dates (specific dates)
                </h3>
                <p className="text-xs text-gray-500 mb-3">Add festivals, holidays, or any specific dates when this salon will be closed. Format: YYYY-MM-DD</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.closedDates.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-sm"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, closedDates: f.closedDates.filter((x) => x !== d) }))}
                        className="hover:text-red-600"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    id="closedDateInput"
                    className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                    onChange={(e) => {
                      const v = e.target.value
                      if (v && !form.closedDates.includes(v)) {
                        setForm((f) => ({ ...f, closedDates: [...f.closedDates, v].sort() }))
                      }
                      e.target.value = ''
                    }}
                  />
                  <label htmlFor="closedDateInput" className="text-xs text-gray-500 self-center">
                    Pick a date to add
                  </label>
                </div>
              </div>
              </div>
              <div className="flex gap-3 justify-end pt-4 px-6 pb-6 shrink-0 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : modal === 'add' ? 'Add' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
