'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, X, Save, Image as ImageIcon, MapPin, ChevronRight, Video, Share2 } from 'lucide-react'
import { setUserRole } from '@/lib/auth'
import { uploadFile } from '@/lib/uploadFile'

const MAX_IMAGES = 50

interface Settings {
  brandName: string
  menuLabel: string
  heroBannerImageUrl: string | null
  currency: string
  heroVideoUrls: string[]
  galleryImageUrls: string[]
  invoiceWebsite: string
  invoiceGst: string
  invoiceSignatureUrl: string | null
  facebookUrl: string
  instagramUrl: string
}

export default function AdminCustomizePage() {
  const [settings, setSettings] = useState<Settings>({
    brandName: 'Salon',
    menuLabel: 'Services',
    heroBannerImageUrl: null,
    currency: 'EUR',
    heroVideoUrls: [],
    galleryImageUrls: [],
    invoiceWebsite: '',
    invoiceGst: '',
    invoiceSignatureUrl: null,
    facebookUrl: '',
    instagramUrl: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)

  useEffect(() => {
    setUserRole('ADMIN')
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      const data = await res.json()
      setSettings({
        brandName: data.brandName ?? 'Salon',
        menuLabel: data.menuLabel ?? 'Services',
        heroBannerImageUrl: data.heroBannerImageUrl ?? null,
        currency: data.currency ?? 'EUR',
        heroVideoUrls: Array.isArray(data.heroVideoUrls) ? data.heroVideoUrls : [],
        galleryImageUrls: Array.isArray(data.galleryImageUrls) ? data.galleryImageUrls : [],
        invoiceWebsite: data.invoiceWebsite ?? '',
        invoiceGst: data.invoiceGst ?? '',
        invoiceSignatureUrl: data.invoiceSignatureUrl ?? null,
        facebookUrl: data.facebookUrl ?? '',
        instagramUrl: data.instagramUrl ?? '',
      })
    } catch {
      setSettings((s) => ({ ...s }))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to save')
      await fetchSettings()
      alert('Customization saved!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideo = file.type === 'video/mp4'
    const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (!isVideo && !isImage) {
      alert('Please select a JPEG, PNG, WebP image or MP4 video.')
      e.target.value = ''
      return
    }
    setUploadingBanner(true)
    try {
      const uploadedUrl = await uploadFile(file, 'hero')
      const payload = { ...settings, heroBannerImageUrl: uploadedUrl }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) throw new Error(saveData?.error || 'Failed to save hero media')
      await fetchSettings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingBanner(false)
      e.target.value = ''
    }
  }

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      alert('Please use PNG, JPEG or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Signature image should be under 2MB.')
      return
    }
    setUploadingSignature(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('type', 'signature')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = typeof data.url === 'string' && data.url.trim() ? data.url.trim() : null
      if (!url) throw new Error('Upload did not return a valid URL')
      setSettings((s) => ({ ...s, invoiceSignatureUrl: url }))
      const payload = { ...settings, invoiceSignatureUrl: url }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) throw new Error(saveData?.error || saveData?.message || 'Failed to save settings')
      await fetchSettings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingSignature(false)
      e.target.value = ''
    }
  }

  const removeSignature = async () => {
    const url = settings.invoiceSignatureUrl
    if (!url) return
    try {
      await fetch('/api/admin/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      setSettings((s) => ({ ...s, invoiceSignatureUrl: null }))
      const payload = { ...settings, invoiceSignatureUrl: null }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!saveRes.ok) throw new Error('Failed to save')
      await fetchSettings()
    } catch {
      alert('Failed to remove signature')
    }
  }

  const removeBanner = async () => {
    const url = settings.heroBannerImageUrl
    if (!url) return
    try {
      // Best-effort R2 delete
      await fetch('/api/admin/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }).catch(() => {})
      const payload = { ...settings, heroBannerImageUrl: null }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!saveRes.ok) throw new Error('Failed to save')
      await fetchSettings()
    } catch {
      alert('Failed to remove hero media. Please try again.')
    }
  }

  const handleFileUpload = async (_type: 'image', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (settings.galleryImageUrls.length >= MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images allowed.`)
      return
    }
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('type', 'gallery')
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 413) throw new Error('File too large. Please use a smaller file.')
        throw new Error((data as { error?: string }).error || 'Upload failed')
      }
      const uploadedUrl = (data as { url?: string }).url
      if (!uploadedUrl || typeof uploadedUrl !== 'string') {
        throw new Error('Upload did not return a valid URL')
      }
      const newUrls = [...settings.galleryImageUrls, uploadedUrl].slice(0, MAX_IMAGES)
      const payload = {
        ...settings,
        galleryImageUrls: newUrls,
      }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) {
        throw new Error(saveData?.error || saveData?.message || 'Failed to save gallery')
      }
      setSettings((s) => ({ ...s, galleryImageUrls: newUrls }))
      await fetchSettings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
      e.target.value = ''
    }
  }

  const removeUrl = async (index: number) => {
    const url = settings.galleryImageUrls[index]
    if (!url) return
    const updatedUrls = settings.galleryImageUrls.filter((_, i) => i !== index)
    setSaving(true)
    try {
      await fetch('/api/admin/upload/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const payload = { ...settings, galleryImageUrls: updatedUrls }
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveData = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok) {
        throw new Error(saveData?.error || saveData?.message || 'Failed to save')
      }
      setSettings((s) => ({ ...s, galleryImageUrls: updatedUrls }))
      await fetchSettings()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Back to admin"
            >
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customize</h1>
              <p className="text-gray-500 text-sm truncate">Brand, menu, videos, gallery & locations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <form onSubmit={handleSave} className="space-y-4 sm:space-y-6">
          {/* Brand & Menu */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Brand & Menu</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand / Salon Name</label>
                <input
                  type="text"
                  value={settings.brandName}
                  onChange={(e) => setSettings((s) => ({ ...s, brandName: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. My Salon"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Menu Label</label>
                <input
                  type="text"
                  value={settings.menuLabel}
                  onChange={(e) => setSettings((s) => ({ ...s, menuLabel: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. Services or Menu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="AED">AED — UAE Dirham (د.إ)</option>
                  <option value="SGD">SGD — Singapore Dollar (S$)</option>
                  <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                  <option value="AUD">AUD — Australian Dollar (A$)</option>
                  <option value="CHF">CHF — Swiss Franc (Fr)</option>
                  <option value="JPY">JPY — Japanese Yen (¥)</option>
                  <option value="SAR">SAR — Saudi Riyal (﷼)</option>
                  <option value="MYR">MYR — Malaysian Ringgit (RM)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Used for all price displays across the site.</p>
              </div>
            </div>
          </div>

          {/* Invoice / Bill details - shown on tax invoice */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice / Bill Details</h2>
            <p className="text-sm text-gray-500 mb-4">Website and GST number shown on tax invoices and bills.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="text"
                  value={settings.invoiceWebsite}
                  onChange={(e) => setSettings((s) => ({ ...s, invoiceWebsite: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. shahnazsalonsasaram.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (GST Number)</label>
                <input
                  type="text"
                  value={settings.invoiceGst}
                  onChange={(e) => setSettings((s) => ({ ...s, invoiceGst: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g. 10DHAPR1747H1ZM"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Signature (on invoice)</label>
                <p className="text-xs text-gray-500 mb-2">Small image shown in the signature box on bills. PNG with transparent background works best.</p>
                <div className="flex items-center gap-3">
                  {settings.invoiceSignatureUrl ? (
                    <>
                      <div className="w-20 h-10 border border-gray-200 rounded flex items-center justify-center bg-white overflow-hidden">
                        <img src={settings.invoiceSignatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex gap-2">
                        <label className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSignature} />
                          {uploadingSignature ? 'Uploading...' : 'Replace'}
                        </label>
                        <button type="button" onClick={removeSignature} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50">
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-600 hover:border-primary-500 hover:bg-primary-50/30 cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSignature} />
                      {uploadingSignature ? 'Uploading...' : 'Upload signature'}
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ImageIcon size={20} />
              Hero Media
            </h2>
            <p className="text-sm text-gray-500 mb-1">One image or video shown as the homepage hero background. Separate from the gallery.</p>
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded mb-4 inline-block">
              Image: JPEG, PNG or WebP • Max 10 MB &nbsp;|&nbsp; Video: MP4 • Max 80 MB
            </p>
            <div className="flex flex-wrap items-start gap-4">
              {settings.heroBannerImageUrl ? (
                <div className="relative group">
                  {settings.heroBannerImageUrl.match(/\.mp4(\?|$)/i) ? (
                    <video
                      src={settings.heroBannerImageUrl}
                      className="w-full max-w-xs h-24 sm:h-28 object-cover rounded-lg border border-gray-200"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={settings.heroBannerImageUrl}
                      alt="Hero preview"
                      className="w-full max-w-xs h-24 sm:h-28 object-cover rounded-lg border border-gray-200"
                    />
                  )}
                  <button
                    type="button"
                    onClick={removeBanner}
                    className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
                    title="Remove hero media"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              <label className="w-40 h-24 sm:w-48 sm:h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition-colors shrink-0">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  className="hidden"
                  onChange={handleBannerUpload}
                  disabled={uploadingBanner}
                />
                {uploadingBanner ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
                ) : (
                  <>
                    <Upload size={22} className="text-gray-400" />
                    <span className="text-xs text-gray-400 text-center px-2">
                      {settings.heroBannerImageUrl ? 'Replace' : 'Upload image or video'}
                    </span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Social Links */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Share2 size={20} />
              Social Links
            </h2>
            <p className="text-sm text-gray-500 mb-4">Facebook and Instagram URLs shown in the footer.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={settings.facebookUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, facebookUrl: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={settings.instagramUrl}
                  onChange={(e) => setSettings((s) => ({ ...s, instagramUrl: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>
            </div>
          </div>

          {/* Home Videos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <Video size={20} />
              Home Videos
            </h2>
            <p className="text-sm text-gray-500 mb-4">Short videos for the home page carousel. Auto-play, muted. MP4 format.</p>
            <Link
              href="/admin/home-videos"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
            >
              Manage home videos
              <ChevronRight size={18} />
            </Link>
          </div>

          {/* Locations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MapPin size={20} />
              Locations
            </h2>
            <p className="text-sm text-gray-500 mb-4">Manage salon locations (name, address, mobile, image). Max 2. Used in booking and on bills.</p>
            <Link
              href="/admin/locations"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-medium text-sm transition-colors"
            >
              Manage locations
              <ChevronRight size={18} />
            </Link>
          </div>

          {/* Gallery Photos (4–5) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ImageIcon size={20} />
              Gallery Photos (up to {MAX_IMAGES})
            </h2>
            <p className="text-sm text-gray-500 mb-1">Photos shown on the site. Also used as carousel slides. JPEG, PNG or WebP.</p>
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded mb-4 inline-block">
              Recommended: 800×600 px (4:3) or 1200×900 • Min 400×300 • Max 10 MB
            </p>
            <div className="flex flex-wrap gap-4">
              {settings.galleryImageUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <div className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUrl(i)}
                    className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow"
                    title="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {settings.galleryImageUrls.length < MAX_IMAGES && (
                <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/50 transition-colors shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleFileUpload('image', e)}
                    disabled={uploadingImage}
                  />
                  {uploadingImage ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
                  ) : (
                    <Upload size={24} className="text-gray-400" />
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              href="/admin"
              className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium min-h-[44px] flex items-center justify-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm font-medium min-h-[44px]"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
