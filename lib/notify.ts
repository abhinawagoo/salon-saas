/**
 * Booking notifications via **WhatsApp Cloud API only** (Meta direct).
 * Configure WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID.
 */

import { format } from 'date-fns'
import { prisma } from './prisma'
import { sendBookingConfirmationWhatsApp, sendStaffBookingAlertWhatsApp } from './whatsapp-cloud'
import { formatTime12h } from './formatTime'
import { getPublicInvoiceUrl } from './invoiceUrl'
import { parseStaffBookingNotifyPhones } from './phone'
import { formatCurrencyPdf } from './currency'

export { parseStaffBookingNotifyPhones }

export interface BookingNotificationPayload {
  customerName: string
  customerMobile: string
  bookingToken: string
  date: string
  timeSlot: string
  servicesSummary: string
  totalAmount: number
  invoiceLink: string
  currency?: string
}

function buildInvoiceLink(token: string): string {
  return getPublicInvoiceUrl(token)
}

function isWhatsAppCloudConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/** Avoid RangeError when Prisma Date is invalid or string is malformed (staff/customer notify). */
function bookingDateToYyyyMmDd(date: Date | string): string {
  if (typeof date === 'string') {
    const s = date.trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const t = new Date(date).getTime()
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  } else if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

function formatDdMmYyyySafe(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd.trim().slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'dd/MM/yyyy')
}

/**
 * After payment first completes: notify location staff (or STAFF/ADMIN users) via WhatsApp.
 * Call once per successful payment (e.g. when transitioning to COMPLETED), not on every redirect.
 */
export async function notifyStaffBookingManagersAfterPayment(bookingId: string): Promise<void> {
  if (process.env.NOTIFY_STAFF_ON_BOOKING === 'false') return
  if (!isWhatsAppCloudConfigured()) return
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      location: true,
      user: { select: { name: true, mobile: true } },
      services: { include: { service: true } },
      payment: true,
    },
  })
  if (!booking?.user) return
  const totalAmount = booking.payment?.totalAmount ?? 0
  const siteConfig = await prisma.siteCustomization.findFirst({ select: { currency: true } })
  const currency = siteConfig?.currency || 'EUR'
  const payload = buildBookingNotificationPayload(
    {
      token: booking.token,
      date: booking.date,
      timeSlot: booking.timeSlot,
      services: booking.services,
      user: booking.user,
    },
    totalAmount,
    currency
  )
  const locationName = booking.location?.name ?? 'Salon'
  const staffPhonesJson = (
    booking.location as { staffBookingNotifyPhones?: string | null } | null | undefined
  )?.staffBookingNotifyPhones
  const locPhones = parseStaffBookingNotifyPhones(staffPhonesJson ?? undefined)
  if (locPhones.length > 0) {
    await notifyStaffManagersForBooking(locPhones, {
      locationName,
      customerName: payload.customerName,
      customerMobile: payload.customerMobile,
      dateStr: payload.date,
      timeSlot: payload.timeSlot,
      servicesSummary: payload.servicesSummary,
      totalAmount: payload.totalAmount,
    })
    return
  }
  const staff = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] } },
    select: { mobile: true },
  })
  for (const s of staff) {
    if (s.mobile && s.mobile !== payload.customerMobile) {
      await sendBookingNotification(s.mobile, payload, 'staff').catch((e) => console.error('Notify staff failed:', e))
    }
  }
}

/**
 * Send staff/manager booking alert template to numbers configured per location (Admin → Locations).
 */
export async function notifyStaffManagersForBooking(
  phones: string[],
  args: {
    locationName: string
    customerName: string
    customerMobile: string
    dateStr: string
    timeSlot: string
    servicesSummary: string
    totalAmount: number
  }
): Promise<void> {
  if (!phones.length || !isWhatsAppCloudConfigured()) return
  const dateDisplay = format(new Date(args.dateStr + 'T12:00:00'), 'dd/MM/yyyy')
  const timeDisplay = formatTime12h(args.timeSlot)
  const amountDisplay = `Rs. ${Math.round(args.totalAmount)}`
  for (const mobile of phones) {
    if (!mobile) continue
    const wa = await sendStaffBookingAlertWhatsApp(mobile, {
      locationName: args.locationName,
      customerName: args.customerName,
      customerMobile: args.customerMobile,
      dateDisplay,
      timeDisplay,
      servicesSummary: args.servicesSummary.slice(0, 200),
      amountDisplay,
    })
    if (!wa.ok) console.error('Staff booking WhatsApp failed:', mobile, wa.error)
  }
}

/**
 * Send booking notification (customer or staff) via WhatsApp Cloud API only.
 */
export async function sendBookingNotification(
  mobile: string,
  payload: BookingNotificationPayload,
  _recipientType: 'customer' | 'staff'
): Promise<{ whatsapp: boolean; sms: boolean }> {
  const result = { whatsapp: false, sms: false }
  const invoiceLink = payload.invoiceLink || buildInvoiceLink(payload.bookingToken)

  if (!isWhatsAppCloudConfigured()) {
    console.warn('notify: WhatsApp Cloud not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)')
    return result
  }

  const wa = await sendBookingConfirmationWhatsApp(
    mobile,
    payload.customerName,
    payload.bookingToken,
    payload.date,
    payload.timeSlot,
    payload.servicesSummary,
    formatCurrencyPdf(payload.totalAmount, payload.currency || 'EUR', 0),
    invoiceLink
  )
  result.whatsapp = wa.ok
  return result
}

/**
 * Build payload from booking + user for notifications.
 */
export function buildBookingNotificationPayload(
  booking: {
    token: string
    date: Date
    timeSlot: string
    services: { service: { name: string }; price: number }[]
    user: { name: string; mobile: string }
  },
  paymentTotal: number,
  currency = 'EUR'
): BookingNotificationPayload {
  const date = bookingDateToYyyyMmDd(booking.date)
  const servicesSummary = booking.services.map((s) => {
    const qty = (s as { quantity?: number }).quantity ?? 1
    return `${s.service.name}${qty > 1 ? ` ×${qty}` : ''} (${formatCurrencyPdf(s.price, currency, 0)})`
  }).join(', ')
  return {
    customerName: booking.user.name,
    customerMobile: booking.user.mobile,
    bookingToken: booking.token,
    date,
    timeSlot: booking.timeSlot,
    servicesSummary: servicesSummary.slice(0, 200),
    totalAmount: paymentTotal,
    invoiceLink: buildInvoiceLink(booking.token),
    currency,
  }
}
