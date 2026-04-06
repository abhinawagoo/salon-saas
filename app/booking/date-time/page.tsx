'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, startOfDay, endOfDay } from 'date-fns'
import DateTimePicker from '@/components/DateTimePicker'

export default function DateTimePage() {
  const router = useRouter()
  const [hasData, setHasData] = useState(false)
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({})
  const [businessHours, setBusinessHours] = useState<string | null>(null)
  const [closedDates, setClosedDates] = useState<string | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(true)

  const [totalDurationMinutes, setTotalDurationMinutes] = useState(30)

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('payment_completed') === '1') {
      sessionStorage.removeItem('payment_completed')
      router.replace('/')
      return
    }
    const locationJson = sessionStorage.getItem('bookingLocation')
    if (!locationJson) {
      router.push('/booking/location')
      return
    }
    setTotalDurationMinutes(60)
    setHasData(true)
    fetchSlotAvailability(locationJson)
  }, [router])

  const fetchSlotAvailability = async (locationJson: string) => {
    try {
      const location = JSON.parse(locationJson) as { id: string }
      const locationId = location.id
      const startDate = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const endDate = format(endOfDay(addDays(new Date(), 30)), 'yyyy-MM-dd')
      const response = await fetch(
        `/api/slots/availability?startDate=${startDate}&endDate=${endDate}&locationId=${encodeURIComponent(locationId)}`
      )
      const data = await response.json()
      setSlotCounts(data.slotCounts ?? data)
      setBusinessHours(data.businessHours ?? null)
      setClosedDates(data.closedDates ?? null)
    } catch (error) {
      console.error('Error fetching slot availability:', error)
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const handleSelect = (date: Date, timeSlot: string) => {
    sessionStorage.setItem('bookingDateTime', JSON.stringify({
      date: format(date, 'yyyy-MM-dd'),
      timeSlot
    }))
    router.push('/booking/customer')
  }

  if (!hasData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Select Date & Time</h1>
          <p className="text-gray-600 mt-0.5 text-sm sm:text-base">Choose your preferred appointment slot</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8 pb-[env(safe-area-inset-bottom)]">
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          {isLoadingSlots ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading availability...</p>
            </div>
          ) : (
            <DateTimePicker onSelect={handleSelect} slotCounts={slotCounts} durationMinutes={totalDurationMinutes} businessHoursJson={businessHours} closedDatesJson={closedDates} />
          )}
        </div>
      </div>
    </div>
  )
}
