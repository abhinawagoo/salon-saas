/**
 * Salon slot configuration. Used by availability API, booking API, and DateTimePicker.
 */

export const SLOT_INTERVAL_MINUTES = 30

/** Full range 6:00–22:00 for custom business hours support. */
const TIME_SLOTS_RAW: string[] = []
for (let h = 6; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m > 0) break
    TIME_SLOTS_RAW.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

export const TIME_SLOTS = TIME_SLOTS_RAW

/** Default closing time (6 PM). Used when no business hours configured. */
export const CLOSING_TIME = { hour: 18, minute: 0 }

/** Extra minutes after closing the salon can work (e.g. finish last appointment). */
export const CLOSING_BUFFER_MINUTES = 60

export const MAX_BOOKINGS_PER_SLOT = 3

export type BusinessHoursDay = {
  dayOfWeek: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  isOpen: boolean
  openTime?: string // "09:00"
  closeTime?: string // "18:00"
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursDay[] = [
  { dayOfWeek: 0, isOpen: false },
  { dayOfWeek: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayOfWeek: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayOfWeek: 3, isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayOfWeek: 4, isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayOfWeek: 5, isOpen: true, openTime: '09:00', closeTime: '18:00' },
  { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '18:00' },
]

export function parseBusinessHours(json: string | null | undefined): BusinessHoursDay[] {
  if (!json) return DEFAULT_BUSINESS_HOURS
  try {
    const arr = JSON.parse(json)
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_BUSINESS_HOURS
    const result: BusinessHoursDay[] = []
    for (let d = 0; d <= 6; d++) {
      const found = arr.find((x: { dayOfWeek?: number }) => x?.dayOfWeek === d)
      if (found && typeof found.isOpen === 'boolean') {
        result.push({
          dayOfWeek: d,
          isOpen: found.isOpen,
          openTime: found.openTime || '09:00',
          closeTime: found.closeTime || '18:00',
        })
      } else {
        result.push(DEFAULT_BUSINESS_HOURS[d] ?? { dayOfWeek: d, isOpen: false })
      }
    }
    return result.length > 0 ? result : DEFAULT_BUSINESS_HOURS
  } catch {
    return DEFAULT_BUSINESS_HOURS
  }
}

export function getDayConfig(hours: BusinessHoursDay[], dayOfWeek: number): BusinessHoursDay {
  return hours.find((h) => h.dayOfWeek === dayOfWeek) ?? { dayOfWeek, isOpen: false }
}

export function getSlotsInRange(startSlot: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const idx = TIME_SLOTS.indexOf(startSlot)
  if (idx === -1) return slots
  const numSlots = Math.ceil(durationMinutes / SLOT_INTERVAL_MINUTES)
  for (let i = 0; i < numSlots && idx + i < TIME_SLOTS.length; i++) {
    slots.push(TIME_SLOTS[idx + i])
  }
  return slots
}

/** Users can book up to 30 min before closing, regardless of service duration. */
const CLOSING_BUFFER_MIN = 30

/**
 * Check if a slot is bookable: appointment must end before closing.
 * Uses actual duration to ensure start + duration fits within closing time.
 */
export function isWithinClosingTime(
  startSlot: string,
  durationMinutes: number,
  closeTime?: string
): boolean {
  const slots = getSlotsInRange(startSlot, durationMinutes)
  if (slots.length === 0) return false
  const lastSlot = slots[slots.length - 1]
  const lastIdx = TIME_SLOTS.indexOf(lastSlot)
  if (lastIdx < 0) return false
  if (!closeTime) return lastIdx <= TIME_SLOTS.indexOf('19:00')
  const [ch, cm] = closeTime.split(':').map(Number)
  const closeMins = (ch || 0) * 60 + (cm || 0)
  const lastValidStartMins = closeMins - CLOSING_BUFFER_MIN
  const lastValidSlotMins = Math.floor(lastValidStartMins / 30) * 30
  const lastValidSlot = `${String(Math.floor(lastValidSlotMins / 60)).padStart(2, '0')}:${String(lastValidSlotMins % 60).padStart(2, '0')}`
  const maxIdx = TIME_SLOTS.indexOf(lastValidSlot)
  if (maxIdx >= 0) return lastIdx <= maxIdx
  const exactIdx = TIME_SLOTS.indexOf(closeTime)
  return exactIdx >= 0 && lastIdx <= exactIdx
}

/**
 * Round a time string (e.g. "10:15", "19:30") to the nearest 30-min slot.
 * roundUp: true = first slot at or after time (for open/close bounds).
 */
function timeToSlot(time: string, roundUp: boolean): string {
  const exact = TIME_SLOTS.indexOf(time)
  if (exact >= 0) return time
  const [h, m] = (time || '09:00').split(':').map(Number)
  const totalMins = (h || 0) * 60 + (m || 0)
  const slotMins = roundUp ? Math.ceil(totalMins / 30) * 30 : Math.floor(totalMins / 30) * 30
  const sh = Math.floor(slotMins / 60)
  const sm = slotMins % 60
  const slot = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`
  return TIME_SLOTS.indexOf(slot) >= 0 ? slot : TIME_SLOTS[0]
}

/**
 * Get slots between openTime and closeTime.
 * Last bookable slot = closeTime - 30 min (users can book up to 30 min before closing).
 */
/**
 * Calculate duration for a group booking (parallel services).
 * Each person's services run in parallel, so total = max of per-person totals.
 * personDurations[i] = array of service durations for person i
 */
export function calcParallelDurationMinutes(personDurations: number[][]): number {
  if (personDurations.length === 0) return 30
  const perPersonTotals = personDurations.map((durations) =>
    durations.reduce((sum, d) => sum + d, 0)
  )
  return Math.max(30, Math.max(...perPersonTotals))
}

export function getSlotsBetween(openTime: string, closeTime: string): string[] {
  const startSlot = timeToSlot(openTime, true)
  const startIdx = TIME_SLOTS.indexOf(startSlot)
  if (startIdx < 0) return []
  const [ch, cm] = (closeTime || '18:00').split(':').map(Number)
  const closeMins = (ch || 0) * 60 + (cm || 0)
  const lastBookableMins = closeMins - CLOSING_BUFFER_MIN
  const lastSlotMins = Math.floor(lastBookableMins / 30) * 30
  const lastSlot = `${String(Math.floor(lastSlotMins / 60)).padStart(2, '0')}:${String(lastSlotMins % 60).padStart(2, '0')}`
  const endIdx = TIME_SLOTS.indexOf(lastSlot)
  if (endIdx < 0 || startIdx > endIdx) return []
  return TIME_SLOTS.slice(startIdx, endIdx + 1)
}
