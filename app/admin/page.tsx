'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Edit, Trash2, Image as ImageIcon, Calendar, Settings, Layers, MessageSquare, MessageCircle, CreditCard } from 'lucide-react'
import { setUserRole } from '@/lib/auth'

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  imageUrl?: string
  isActive: boolean
  categoryId?: string | null
  subCategoryId?: string | null
  bookingCount?: number
}

export default function AdminDashboard() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [detailService, setDetailService] = useState<Service | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Service | null>(null)

  useEffect(() => {
    setUserRole('ADMIN')
  }, [])

  const fetchServices = async () => {
    try {
      const url = showInactive ? '/api/admin/services?includeInactive=true' : '/api/admin/services'
      const response = await fetch(url)
      const data = await response.json()
      // Ensure data is an array
      if (Array.isArray(data)) {
        setServices(data)
      } else {
        console.error('Invalid data format:', data)
        setServices([])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      setServices([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [showInactive])

  const handleDeleteClick = (service: Service) => {
    setDeleteConfirm(service)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    try {
      const res = await fetch(`/api/admin/services/${deleteConfirm.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to delete')
      }
      setDeleteConfirm(null)
      fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete service')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/admin/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      })
      fetchServices()
    } catch (error) {
      console.error('Error updating service:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm mt-0.5">Services & bookings</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/customize"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Settings size={18} />
                Customize
              </Link>
              <Link
                href="/admin/categories"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Layers size={18} />
                Categories
              </Link>
              <Link
                href="/admin/bookings"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Calendar size={18} />
                Bookings
              </Link>
              <Link
                href="/admin/calendar"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm font-medium transition-colors min-h-[44px] border border-amber-200"
              >
                <Calendar size={18} />
                Calendar
              </Link>
              <Link
                href="/admin/payment-settings"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <CreditCard size={18} />
                Payments
              </Link>
              <Link
                href="/admin/crm"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <MessageSquare size={18} />
                CRM
              </Link>
              <Link
                href="/admin/whatsapp"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition-colors min-h-[44px]"
              >
                <MessageCircle size={18} />
                Inbox
              </Link>
              <button
                type="button"
                onClick={() => { setEditingService(null); setShowModal(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Plus size={18} />
                Add Service
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">Services</h2>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Show inactive
            </label>
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : services.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {showInactive ? 'No services found.' : 'No active services.'} Click &quot;Add Service&quot; to create one.
              {!showInactive && (
                <span className="block mt-2 text-sm">Toggle &quot;Show inactive&quot; to see deactivated services.</span>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[520px] table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[40%]">Service</th>
                    <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Price</th>
                    <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">Duration</th>
                    <th className="px-4 sm:px-6 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">Status</th>
                    <th className="px-4 sm:px-6 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[22%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(services) && services.map((service) => (
                    <tr
                      key={service.id}
                      onClick={() => setDetailService(service)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-2.5 align-top">
                        <div className="flex items-start gap-3 min-w-0">
                          {service.imageUrl ? (
                            <img src={service.imageUrl} alt={service.name} className="w-12 h-12 rounded object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded bg-primary-100 flex items-center justify-center shrink-0">
                              <ImageIcon className="text-primary-600" size={20} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{service.name}</div>
                            {service.description ? (
                              <div className="text-sm text-gray-500 line-clamp-2 mt-0.5">{service.description}</div>
                            ) : (
                              <div className="text-sm text-gray-400 italic mt-0.5">No description</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-2.5 whitespace-nowrap text-gray-900 align-top">₹{service.price}</td>
                      <td className="px-4 sm:px-6 py-2.5 whitespace-nowrap text-gray-500 align-top" onClick={(e) => e.stopPropagation()}>
                        {service.duration} min
                      </td>
                      <td className="px-4 sm:px-6 py-2.5 whitespace-nowrap align-top" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleActive(service.id, service.isActive)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            service.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {service.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-2.5 whitespace-nowrap text-right text-sm font-medium align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingService(service)
                              setShowModal(true)
                            }}
                            className="text-primary-600 hover:text-primary-900 p-1.5 rounded hover:bg-primary-50"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(service)}
                            className="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50"
                            title="Delete or deactivate service"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Quick Stats</h2>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Services</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{services.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-green-600 font-medium">Active</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900">
                {services.filter(s => s.isActive).length}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-purple-600 font-medium">Revenue</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">₹0</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <Link
              href="/admin/bookings"
              className="p-4 sm:p-5 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3 sm:gap-4 min-h-[72px]"
            >
              <div className="bg-primary-100 rounded-full p-2.5 sm:p-3 shrink-0">
                <Calendar className="text-primary-600" size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">View Bookings</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Day by day, filter by location</p>
              </div>
            </Link>
            <Link
              href="/admin/crm"
              className="p-4 sm:p-5 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3 sm:gap-4 min-h-[72px]"
            >
              <div className="bg-primary-100 rounded-full p-2.5 sm:p-3 shrink-0">
                <MessageSquare className="text-primary-600" size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Customer CRM</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Send WhatsApp offers in bulk</p>
              </div>
            </Link>
            <Link
              href="/admin/whatsapp"
              className="p-4 sm:p-5 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3 sm:gap-4 min-h-[72px]"
            >
              <div className="bg-primary-100 rounded-full p-2.5 sm:p-3 shrink-0">
                <MessageCircle className="text-primary-600" size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 text-sm sm:text-base">WhatsApp Inbox</h3>
                <p className="text-xs sm:text-sm text-gray-600 truncate">Unified chat — all messages</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {detailService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDetailService(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-start gap-4 shrink-0">
              {detailService.imageUrl ? (
                <img src={detailService.imageUrl} alt={detailService.name} className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-primary-100 flex items-center justify-center">
                  <ImageIcon className="text-primary-600" size={28} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-semibold text-gray-900">{detailService.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">₹{detailService.price} · {detailService.duration} min</p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  detailService.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {detailService.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
              {detailService.description ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{detailService.description}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No description</p>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3 justify-end border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setDetailService(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingService(detailService)
                  setDetailService(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm inline-flex items-center gap-1.5"
              >
                <Edit size={16} />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
            {(deleteConfirm.bookingCount ?? 0) === 0 ? (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Delete service permanently?</h3>
                <p className="text-gray-600 text-sm mb-6">
                  This service has no bookings. It will be permanently removed. This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Delete permanently
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Deactivate service?</h3>
                <p className="text-gray-600 text-sm mb-4">
                  This service has <strong>{deleteConfirm.bookingCount} booking(s)</strong>. Past bookings need to retain the service details, so it cannot be permanently deleted.
                </p>
                <p className="text-gray-600 text-sm mb-6">
                  Deactivating will hide this service from customers. It will no longer appear in the booking flow. You can reactivate it anytime using the status toggle.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Deactivate
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <ServiceModal
          service={editingService}
          onClose={() => {
            setShowModal(false)
            setEditingService(null)
          }}
          onSave={() => {
            fetchServices()
            setShowModal(false)
            setEditingService(null)
          }}
        />
      )}
    </div>
  )
}

interface SubCategory {
  id: string
  name: string
  slug: string
  order: number
}

interface Category {
  id: string
  name: string
  slug: string
  order: number
  subcategories?: SubCategory[]
}

function ServiceModal({ service, onClose, onSave }: { service: Service | null; onClose: () => void; onSave: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price ?? '',
    duration: service?.duration ?? '',
    imageUrl: service?.imageUrl || '',
    categoryId: service?.categoryId ?? '',
    subCategoryId: service?.subCategoryId ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
  }, [])
  useEffect(() => {
    if (service) {
      let categoryId = service.categoryId ?? ''
      const subCategoryId = service.subCategoryId ?? ''
      if (subCategoryId && !categoryId && categories.length > 0) {
        for (const cat of categories) {
          const found = cat.subcategories?.some((s) => s.id === subCategoryId)
          if (found) {
            categoryId = cat.id
            break
          }
        }
      }
      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: service.price ?? '',
        duration: service.duration ?? '',
        imageUrl: service.imageUrl ?? '',
        categoryId,
        subCategoryId,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        price: '',
        duration: '',
        imageUrl: '',
        categoryId: '',
        subCategoryId: '',
      })
    }
  }, [service?.id, service?.name, service?.description, service?.price, service?.duration, service?.categoryId, service?.subCategoryId, service?.imageUrl, categories])

  const deleteImageFromStorage = async (url: string) => {
    try {
      await fetch('/api/admin/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
    } catch {
      // continue
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image (JPEG, PNG, WebP, GIF).')
      return
    }
    setUploadingImage(true)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('type', 'service')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setFormData((f) => ({ ...f, imageUrl: data.url || '' }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cat = categories.find((c) => c.id === formData.categoryId)
    const subs = cat?.subcategories ?? []
    if (formData.categoryId && subs.length > 0 && !formData.subCategoryId) {
      alert('Please select a subcategory. Services belong under subcategories.')
      return
    }
    const price = formData.price === '' || formData.price === undefined ? 0 : Number(formData.price)
    const duration = formData.duration === '' || formData.duration === undefined ? 30 : Math.max(1, parseInt(String(formData.duration), 10) || 30)
    if (price < 0 || duration < 1) {
      alert('Please enter valid price and duration.')
      return
    }
    setIsSubmitting(true)
    try {
      const url = service 
        ? `/api/admin/services/${service.id}`
        : '/api/admin/services'
      
      const response = await fetch(url, {
        method: service ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, price, duration }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save service')
      }

      onSave()
    } catch (error: any) {
      console.error('Error saving service:', error)
      alert(error.message || 'Failed to save service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-8">
          <h2 className="text-3xl font-light text-gray-900 mb-8">{service ? 'Edit Service' : 'Add New Service'}</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-light text-gray-700 mb-3">Service Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light text-lg"
                placeholder="e.g., Haircut & Styling"
              />
            </div>
            <div>
              <label className="block text-sm font-light text-gray-700 mb-3">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light resize-none"
                rows={4}
                placeholder="Describe what this service includes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-light text-gray-700 mb-3">Price (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price === '' || formData.price === undefined ? '' : formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light text-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-light text-gray-700 mb-3">Duration (minutes) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration === '' || formData.duration === undefined ? '' : formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 0) })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light text-lg"
                  placeholder="30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-light text-gray-700 mb-3">Category (menu)</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {formData.categoryId && (() => {
              const cat = categories.find((c) => c.id === formData.categoryId)
              const subs = cat?.subcategories ?? []
              if (subs.length === 0) return null
              return (
                <div>
                  <label className="block text-sm font-light text-gray-700 mb-3">Subcategory *</label>
                  <select
                    required
                    value={formData.subCategoryId}
                    onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent transition-all font-light"
                  >
                    <option value="">Select subcategory</option>
                    {subs.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Services belong under subcategories</p>
                </div>
              )
            })()}
            <div>
              <label className="block text-sm font-light text-gray-700 mb-1">Service image</label>
              <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mb-3 inline-block">
                Recommended: 600×450 px (4:3) or 400×300 • Min 200×150 • Max 5 MB
              </p>
              {formData.imageUrl ? (
                <div className="flex items-center gap-3">
                  <img src={formData.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.imageUrl) deleteImageFromStorage(formData.imageUrl)
                        setFormData((f) => ({ ...f, imageUrl: '' }))
                      }}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove image
                    </button>
                    <label className="text-sm text-gray-600 cursor-pointer">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                      {uploadingImage ? 'Uploading...' : 'Replace with new'}
                    </label>
                  </div>
                </div>
              ) : (
                <label className="block w-full px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all text-center text-gray-500 text-sm">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                  {uploadingImage ? 'Uploading...' : 'Upload image (JPEG, PNG, WebP, GIF)'}
                </label>
              )}
            </div>
            <div className="flex gap-4 justify-end pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 border border-gray-200 rounded-full hover:bg-gray-50 transition-all font-light"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-all font-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : (service ? 'Update Service' : 'Create Service')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
