'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfDay, endOfDay, addDays } from 'date-fns'
import ServiceCard from '@/components/ServiceCard'
import ServiceModal from '@/components/ServiceModal'
import { ChevronRight, Users, User } from 'lucide-react'
import { parseBusinessHours, getDayConfig, isWithinClosingTime } from '@/lib/slots'

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  imageUrl?: string
  categoryId?: string
  subCategoryId?: string
}

type ServiceWithQty = Service & { quantity: number }

interface SubCategory {
  id: string
  name: string
  slug: string
  description?: string
  imageUrl?: string
  order: number
  services: Service[]
}

interface Category {
  id: string
  name: string
  slug: string
  order: number
  services?: Service[]
  subcategories?: SubCategory[]
}

const PERSON_LABELS = ['Me', 'Friend', 'Family', 'Guest 4', 'Guest 5', 'Guest 6']
const MAX_GROUP = 6

export default function BookingServicesPage() {
  const router = useRouter()
  const [hasData, setHasData] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)
  const [subcategoryPopupCategory, setSubcategoryPopupCategory] = useState<Category | null>(null)
  const [modalService, setModalService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showClosingTimePopup, setShowClosingTimePopup] = useState(false)
  const [businessHoursJson, setBusinessHoursJson] = useState<string | null>(null)
  const [totalBump, setTotalBump] = useState(false)

  // Group booking state
  const [groupSize, setGroupSize] = useState(1)
  const [activePersonIndex, setActivePersonIndex] = useState(0)
  // personServices[i] = services for person i
  const [personServices, setPersonServices] = useState<ServiceWithQty[][]>([[]])

  // Computed
  const activeServices = personServices[activePersonIndex] ?? []

  const parallelDurationMinutes = (() => {
    if (personServices.length === 0) return 0
    const totals = personServices.map((ps) =>
      ps.reduce((sum, s) => sum + s.duration * s.quantity, 0)
    )
    return Math.max(...totals, 0)
  })()

  const totalPrice = personServices.flat().reduce((sum, s) => sum + s.price * s.quantity, 0)
  const totalItems = personServices.flat().reduce((sum, s) => sum + s.quantity, 0)

  const checkWouldExceedClosing = (duration: number): boolean => {
    if (!businessHoursJson) return false
    const dateTime = sessionStorage.getItem('bookingDateTime')
    if (!dateTime) return false
    const dt = JSON.parse(dateTime) as { date: string; timeSlot: string }
    const businessHours = parseBusinessHours(businessHoursJson)
    const bookingDate = new Date(dt.date)
    const dayConfig = getDayConfig(businessHours, bookingDate.getDay())
    return !isWithinClosingTime(dt.timeSlot, duration, dayConfig.closeTime || '18:00')
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('payment_completed') === '1') {
      sessionStorage.removeItem('payment_completed')
      router.replace('/')
      return
    }
    const location = sessionStorage.getItem('bookingLocation')
    const dateTime = sessionStorage.getItem('bookingDateTime')
    const customer = sessionStorage.getItem('customerDetails')
    if (!location || !dateTime || !customer) {
      router.push('/booking/location')
      return
    }
    setHasData(true)

    // Restore saved services
    const savedServices = sessionStorage.getItem('selectedServices')
    if (savedServices) {
      try {
        const p = JSON.parse(savedServices)
        if (p?.version === 2 && Array.isArray(p.persons)) {
          setGroupSize(p.groupSize ?? 1)
          const ps: ServiceWithQty[][] = Array.from({ length: p.groupSize ?? 1 }, () => [])
          p.persons.forEach((person: { personIndex: number; services: ServiceWithQty[] }) => {
            if (person.personIndex < ps.length) {
              ps[person.personIndex] = person.services.map((s) => ({ ...s, quantity: s.quantity ?? 1 }))
            }
          })
          setPersonServices(ps)
        } else if (Array.isArray(p) && p.length > 0) {
          setPersonServices([p.map((s) => ({ ...s, quantity: s.quantity ?? 1 }))])
        }
      } catch { /* ignore */ }
    }

    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/services')
      .then((res) => res.json())
      .then((data) => setAllServices(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))

    const loc = sessionStorage.getItem('bookingLocation')
    if (loc) {
      const { id } = JSON.parse(loc) as { id: string }
      const startDate = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const endDate = format(endOfDay(addDays(new Date(), 30)), 'yyyy-MM-dd')
      fetch(`/api/slots/availability?startDate=${startDate}&endDate=${endDate}&locationId=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((data) => setBusinessHoursJson(data.businessHours ?? null))
        .catch(() => {})
    }
  }, [router])

  const handleGroupSizeChange = (size: number) => {
    setGroupSize(size)
    setPersonServices((prev) => {
      const next = Array.from({ length: size }, (_, i) => prev[i] ?? [])
      return next
    })
    setActivePersonIndex((prev) => Math.min(prev, size - 1))
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const selectedSubcategory = selectedCategory?.subcategories?.find((s) => s.id === selectedSubcategoryId)

  const displayServices = (() => {
    if (selectedSubcategoryId && selectedSubcategory) {
      const from = selectedSubcategory.services ?? []
      return from.length > 0 ? from : allServices.filter((s) => s.subCategoryId === selectedSubcategoryId)
    }
    if (selectedCategoryId && selectedCategory) {
      const subs = selectedCategory.subcategories ?? []
      if (subs.length > 0) return subs.flatMap((s) => s.services ?? [])
      if ((selectedCategory.services ?? []).length > 0) return selectedCategory.services!
      return allServices.filter((s) => s.categoryId === selectedCategoryId)
    }
    return allServices
  })()

  const handleCategoryClick = (cat: Category) => {
    const subs = cat.subcategories ?? []
    if (subs.length > 0) {
      setSubcategoryPopupCategory(cat)
      setSelectedCategoryId(null)
      setSelectedSubcategoryId(null)
    } else {
      setSubcategoryPopupCategory(null)
      setSelectedCategoryId(cat.id)
      setSelectedSubcategoryId(null)
    }
  }

  const handleSubcategorySelect = (sub: SubCategory | null) => {
    if (subcategoryPopupCategory) {
      setSelectedCategoryId(subcategoryPopupCategory.id)
      setSelectedSubcategoryId(sub?.id ?? null)
      setSubcategoryPopupCategory(null)
    }
  }

  const addServiceToActivePerson = (service: Service) => {
    setPersonServices((prev) => {
      const next = prev.map((ps, i) => {
        if (i !== activePersonIndex) return ps
        const existing = ps.find((s) => s.id === service.id)
        if (existing) return ps.map((s) => s.id === service.id ? { ...s, quantity: s.quantity + 1 } : s)
        return [...ps, { ...service, quantity: 1 }]
      })
      // Check closing time with new parallel duration
      const newParallel = Math.max(...next.map((ps) => ps.reduce((sum, s) => sum + s.duration * s.quantity, 0)), 0)
      if (checkWouldExceedClosing(newParallel)) {
        setShowClosingTimePopup(true)
        return prev
      }
      setTotalBump(true)
      setTimeout(() => setTotalBump(false), 400)
      return next
    })
    setModalService(null)
  }

  const handleIncreaseQuantity = (serviceId: string) => {
    setPersonServices((prev) => {
      const next = prev.map((ps, i) => {
        if (i !== activePersonIndex) return ps
        return ps.map((s) => s.id === serviceId ? { ...s, quantity: s.quantity + 1 } : s)
      })
      const newParallel = Math.max(...next.map((ps) => ps.reduce((sum, s) => sum + s.duration * s.quantity, 0)), 0)
      if (checkWouldExceedClosing(newParallel)) {
        setShowClosingTimePopup(true)
        return prev
      }
      setTotalBump(true)
      setTimeout(() => setTotalBump(false), 400)
      return next
    })
  }

  const handleDecreaseQuantity = (serviceId: string) => {
    setPersonServices((prev) =>
      prev.map((ps, i) => {
        if (i !== activePersonIndex) return ps
        const item = ps.find((s) => s.id === serviceId)
        if (!item) return ps
        if (item.quantity <= 1) return ps.filter((s) => s.id !== serviceId)
        return ps.map((s) => s.id === serviceId ? { ...s, quantity: s.quantity - 1 } : s)
      })
    )
  }

  const handleDeleteService = (serviceId: string) => {
    setPersonServices((prev) =>
      prev.map((ps, i) => (i !== activePersonIndex ? ps : ps.filter((s) => s.id !== serviceId)))
    )
  }

  const handleContinue = () => {
    if (totalItems === 0) {
      alert('Please add at least one service.')
      return
    }
    if (checkWouldExceedClosing(parallelDurationMinutes)) {
      setShowClosingTimePopup(true)
      return
    }
    sessionStorage.setItem('selectedServices', JSON.stringify({
      version: 2,
      groupSize,
      persons: personServices.map((services, i) => ({ personIndex: i, services })),
    }))
    router.push('/booking/payment')
  }

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  if (!hasData) return null

  return (
    <div className="min-h-screen bg-cream pb-28">
      {/* Header */}
      <div className="bg-charcoal-dark">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6">
          <p className="text-white/30 text-[9px] tracking-[0.5em] uppercase font-sans mb-1">Step 3</p>
          <h1 className="font-serif text-white text-xl sm:text-2xl font-light">Choose Services</h1>

          {/* Group size picker */}
          <div className="mt-4">
            <p className="text-white/40 text-[10px] tracking-[0.3em] uppercase font-sans mb-2">
              <Users size={10} className="inline mr-1.5" />
              Booking for
            </p>
            <div className="flex gap-2">
              {Array.from({ length: MAX_GROUP }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleGroupSizeChange(n)}
                  className={`w-9 h-9 rounded-full text-sm font-sans font-medium transition-all ${
                    groupSize === n
                      ? 'bg-gold text-charcoal-dark'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Person tabs (show when groupSize > 1) */}
        {groupSize > 1 && (
          <div className="flex border-t border-white/10 overflow-x-auto">
            {Array.from({ length: groupSize }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActivePersonIndex(i)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-sans tracking-wide whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                  activePersonIndex === i
                    ? 'border-gold text-white font-medium'
                    : 'border-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <User size={12} />
                {PERSON_LABELS[i] ?? `Person ${i + 1}`}
                {(personServices[i] ?? []).length > 0 && (
                  <span className="bg-gold text-charcoal-dark text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {(personServices[i] ?? []).reduce((sum, s) => sum + s.quantity, 0)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-4">
          <button
            type="button"
            onClick={() => { setSelectedCategoryId(null); setSelectedSubcategoryId(null); setSubcategoryPopupCategory(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-colors min-h-[32px] touch-manipulation ${
              !selectedCategoryId ? 'bg-charcoal-dark text-white' : 'bg-white border border-ivory text-charcoal hover:bg-ivory'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans font-medium transition-colors min-h-[32px] touch-manipulation ${
                selectedCategoryId === cat.id ? 'bg-charcoal-dark text-white' : 'bg-white border border-ivory text-charcoal hover:bg-ivory'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-ivory animate-pulse overflow-hidden">
                <div className="aspect-[4/3] bg-ivory" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-ivory rounded w-3/4" />
                  <div className="h-3 bg-ivory rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {displayServices.map((service) => {
              const item = activeServices.find((s) => s.id === service.id)
              return (
                <ServiceCard
                  key={service.id}
                  id={service.id}
                  name={service.name}
                  description={service.description}
                  price={service.price}
                  duration={service.duration}
                  imageUrl={service.imageUrl}
                  onAdd={() => setModalService(service)}
                  onCardClick={() => setModalService(service)}
                  quantity={item?.quantity ?? 0}
                  onIncrease={() => handleIncreaseQuantity(service.id)}
                  onDecrease={() => handleDecreaseQuantity(service.id)}
                  onDelete={() => handleDeleteService(service.id)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed left-0 right-0 bottom-0 bg-charcoal-dark border-t border-white/10 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 min-h-[52px]">
          <div className={`transition-all duration-200 min-w-0 ${totalBump ? 'scale-105' : 'scale-100'}`}>
            <p className="text-white text-sm font-sans font-medium">
              {totalItems} {totalItems === 1 ? 'service' : 'services'} · ₹{totalPrice.toLocaleString('en-IN')}
            </p>
            {parallelDurationMinutes > 0 && (
              <p className="text-white/40 text-[10px] font-sans mt-0.5">
                {groupSize > 1 ? `~${formatDuration(parallelDurationMinutes)} parallel` : formatDuration(parallelDurationMinutes)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={totalItems === 0}
            className="flex-shrink-0 flex items-center gap-1.5 bg-gold hover:bg-gold-dark disabled:opacity-40 disabled:cursor-not-allowed text-charcoal-dark text-xs tracking-[0.15em] uppercase font-sans font-medium px-5 py-3 rounded-full transition-all active:scale-95"
          >
            Continue
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Subcategory popup */}
      {subcategoryPopupCategory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-ivory">
              <h3 className="font-serif text-charcoal-dark text-lg">{subcategoryPopupCategory.name}</h3>
              <p className="text-stone text-xs font-sans mt-0.5">Select a category</p>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              <button
                type="button"
                onClick={() => handleSubcategorySelect(null)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-ivory hover:border-gold/40 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-ivory flex items-center justify-center text-stone font-sans text-sm">All</div>
                <p className="font-sans text-charcoal text-sm">All {subcategoryPopupCategory.name}</p>
              </button>
              {(subcategoryPopupCategory.subcategories ?? []).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => handleSubcategorySelect(sub)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-ivory hover:border-gold/40 transition-all text-left"
                >
                  {sub.imageUrl ? (
                    <img src={sub.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-ivory flex items-center justify-center text-stone font-sans text-sm font-medium">{sub.name.charAt(0)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-charcoal text-sm">{sub.name}</p>
                    <p className="text-stone text-xs">{sub.services?.length ?? 0} services</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-ivory">
              <button type="button" onClick={() => setSubcategoryPopupCategory(null)} className="w-full py-2.5 text-stone font-sans text-sm hover:text-charcoal">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closing time popup */}
      {showClosingTimePopup && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <h3 className="font-serif text-charcoal-dark text-xl mb-2">Time conflict</h3>
            <p className="text-stone font-sans text-sm mb-4">
              Your selected services would end after salon closing time. Please choose an earlier slot or reduce services.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => { setShowClosingTimePopup(false); router.push('/booking/date-time') }} className="w-full py-3 bg-charcoal-dark text-white rounded-xl font-sans text-sm font-medium">
                Change date & time
              </button>
              <button type="button" onClick={() => setShowClosingTimePopup(false)} className="w-full py-3 border border-ivory text-charcoal-dark rounded-xl font-sans text-sm">
                Reduce services
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service modal */}
      {modalService && (
        <ServiceModal
          service={modalService}
          isOpen
          onClose={() => setModalService(null)}
          onAdd={() => addServiceToActivePerson(modalService)}
          quantity={activeServices.find((s) => s.id === modalService.id)?.quantity ?? 0}
          onIncrease={() => handleIncreaseQuantity(modalService.id)}
          onDecrease={() => handleDecreaseQuantity(modalService.id)}
          onDelete={() => { handleDeleteService(modalService.id); setModalService(null) }}
        />
      )}
    </div>
  )
}
