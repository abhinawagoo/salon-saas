import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthFromCookie } from '@/lib/auth-jwt'
import { AUTH_DISABLED_FOR_NOW } from '@/lib/auth'
import { getSlotsInRange, isWithinClosingTime, calcParallelDurationMinutes, parseBusinessHours, getDayConfig } from '@/lib/slots'
import { buildBookingNotificationPayload, sendBookingNotification } from '@/lib/notify'
import { normalizeMobileForDb } from '@/lib/phone'
import { createPhonePePayment } from '@/lib/phonepe'
import { parsePaymentConfig, getEnabledOptions, calcOptionAmount } from '@/lib/paymentConfig'
import { nanoid } from 'nanoid'

type UserRow = { id: string; name: string; mobile: string; role: string }

function generateToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase() + 
         Math.random().toString(36).substring(2, 10).toUpperCase()
}

async function initiatePhonePePayment(bookingId: string, amount: number): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUrl = `${appUrl}/api/payment/callback?bookingId=${encodeURIComponent(bookingId)}`
  const amountPaisa = Math.round(amount * 100)
  return createPhonePePayment(bookingId, amountPaisa, redirectUrl)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { locationId, services, groupServices, groupSize, customerDetails, date, timeSlot, paymentType } = body

    // Normalize to per-person format
    // groupServices: [{ personIndex: number, serviceIds: string[] }]
    // services (legacy): string[] — treated as all from person 0
    type PersonServices = { personIndex: number; serviceIds: string[] }
    const personsData: PersonServices[] = groupServices && Array.isArray(groupServices)
      ? groupServices
      : [{ personIndex: 0, serviceIds: Array.isArray(services) ? services : [] }]
    const bookingGroupSize: number = groupSize && groupSize > 1 ? Math.min(groupSize, 10) : personsData.length || 1

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      )
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId, isActive: true },
    })
    if (!location) {
      return NextResponse.json(
        { error: 'Invalid or inactive location' },
        { status: 400 }
      )
    }

    // Require login when auth is enabled - user must create profile (verify mobile) before booking
    const authRequired = !AUTH_DISABLED_FOR_NOW && process.env.NEXT_PUBLIC_DISABLE_AUTH !== 'true'
    const auth = getAuthFromCookie()
    if (authRequired && !auth) {
      return NextResponse.json(
        { error: 'Please login to book an appointment. Verify your mobile number first.' },
        { status: 401 }
      )
    }

    const mobile = normalizeMobileForDb(customerDetails.mobile || '')
    if (authRequired && auth && auth.mobile !== mobile) {
      return NextResponse.json(
        { error: 'Booking must be made with your verified mobile number. Please use the same number you logged in with.' },
        { status: 400 }
      )
    }

    let user: UserRow | null = null

    if (auth && auth.mobile === mobile) {
      const byId = await prisma.$queryRaw<UserRow[]>`
        SELECT id, name, mobile, role FROM "User" WHERE id = ${auth.userId} LIMIT 1
      `
      if (byId.length > 0) user = byId[0]
    }
    if (!user) {
      const byMobile = await prisma.$queryRaw<UserRow[]>`
        SELECT id, name, mobile, role FROM "User" WHERE mobile = ${mobile} LIMIT 1
      `
      if (byMobile.length > 0) user = byMobile[0]
    }
    if (!user) {
      // When auth required, user must exist (created via login) - no auto-create
      if (authRequired) {
        return NextResponse.json(
          { error: 'Please login first to book an appointment. Verify your mobile number.' },
          { status: 401 }
        )
      }
      const id = nanoid(24)
      await prisma.$executeRaw`
        INSERT INTO "User" (id, name, mobile, role, "createdAt", "updatedAt")
        VALUES (${id}, ${customerDetails.name || 'Guest'}, ${mobile}, 'CUSTOMER', now(), now())
      `
      user = { id, name: customerDetails.name || 'Guest', mobile, role: 'CUSTOMER' }
    } else if (customerDetails.name && customerDetails.name !== user.name) {
      await prisma.$executeRaw`
        UPDATE "User" SET name = ${customerDetails.name}, "updatedAt" = now() WHERE id = ${user.id}
      `
      user = { ...user, name: customerDetails.name }
    }

    // Collect all service IDs across all persons
    const allServiceIds = personsData.flatMap((p) => p.serviceIds)
    const uniqueIds = [...new Set(allServiceIds)]
    const serviceDetails = await prisma.service.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
    })
    const serviceMap = new Map(serviceDetails.map((s) => [s.id, s]))
    const invalidIds = allServiceIds.filter((id) => !serviceMap.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: 'Some services are invalid or inactive' },
        { status: 400 }
      )
    }

    // Parallel duration: each person's services run concurrently with others
    // Total = max(per-person duration sums)
    const personDurations = personsData.map((p) =>
      p.serviceIds.map((id) => serviceMap.get(id)?.duration ?? 0)
    )
    const totalDurationMinutes = calcParallelDurationMinutes(personDurations)

    // Validate: day is open and time is within business hours (per location)
    // Normalise date to YYYY-MM-DD for UTC-safe handling throughout
    const dateStr = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date(date).toISOString().slice(0, 10)
    const bookingDate = new Date(`${dateStr}T00:00:00.000Z`)
    const dayOfWeek = bookingDate.getUTCDay()
    const locationWithHours = await prisma.location.findUnique({
      where: { id: locationId },
      select: { businessHoursJson: true, closedDatesJson: true },
    })
    const businessHours = parseBusinessHours(locationWithHours?.businessHoursJson ?? null)
    const closedDates: string[] = (() => {
      if (!locationWithHours?.closedDatesJson) return []
      try {
        const parsed = JSON.parse(locationWithHours.closedDatesJson)
        return Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        return []
      }
    })()
    if (closedDates.includes(dateStr)) {
      return NextResponse.json(
        { error: 'The salon is closed on this date. Please choose another date.' },
        { status: 400 }
      )
    }
    const dayConfig = getDayConfig(businessHours, dayOfWeek)
    if (!dayConfig.isOpen) {
      return NextResponse.json(
        { error: 'The salon is closed on this day. Please choose another date.' },
        { status: 400 }
      )
    }
    const closeTime = dayConfig.closeTime || '18:00'
    if (!isWithinClosingTime(timeSlot, totalDurationMinutes, closeTime)) {
      return NextResponse.json(
        { error: 'Selected time would end after salon closing. Please choose an earlier slot.' },
        { status: 400 }
      )
    }

    // Build occupancy for this date — UTC-anchored range matches how bookings are stored
    const startOfBookingDate = new Date(`${dateStr}T00:00:00.000Z`)
    const endOfBookingDate   = new Date(`${dateStr}T23:59:59.999Z`)

    const [existingBookings, locationCapacity] = await Promise.all([
      prisma.booking.findMany({
        where: {
          locationId,
          date: { gte: startOfBookingDate, lte: endOfBookingDate },
          status: { not: 'CANCELLED' },
        },
        select: { timeSlot: true, durationMinutes: true },
      }),
      prisma.location.findUnique({ where: { id: locationId }, select: { concurrentSlots: true } }),
    ])
    const maxConcurrent = locationCapacity?.concurrentSlots ?? 1

    const slotCounts: Record<string, number> = {}
    existingBookings.forEach((b) => {
      const duration = b.durationMinutes ?? 30
      getSlotsInRange(b.timeSlot, duration).forEach((slot) => {
        slotCounts[slot] = (slotCounts[slot] || 0) + 1
      })
    })

    const newBookingSlots = getSlotsInRange(timeSlot, totalDurationMinutes)
    const wouldExceed = newBookingSlots.some((slot) => (slotCounts[slot] || 0) >= maxConcurrent)
    if (wouldExceed) {
      return NextResponse.json(
        { error: `This time is fully booked. Please choose another time slot.` },
        { status: 400 }
      )
    }

    // Calculate total amount - sum all service prices across all persons
    const totalAmount = allServiceIds.reduce((sum, id) => sum + (serviceMap.get(id)?.price ?? 0), 0)

    // Resolve advance amount from payment config (admin-configured %, not hardcoded 30%)
    let advanceAmount = totalAmount
    const isFreeBooking = paymentType === 'FREE'
    if (paymentType === 'ADVANCE') {
      const configRow = await prisma.siteCustomization.findUnique({
        where: { id: 1 },
        select: { paymentConfigJson: true },
      })
      const config = parsePaymentConfig(configRow?.paymentConfigJson)
      const advOpt = getEnabledOptions(config).find((o) => o.type === 'ADVANCE')
      advanceAmount = advOpt ? calcOptionAmount(advOpt, totalAmount) : totalAmount * 0.3
    } else if (isFreeBooking) {
      advanceAmount = 0
    }

    const bookingToken = generateToken()

    // Build BookingService rows: unique (bookingId, serviceId, personIndex) with quantity
    // Group by (personIndex, serviceId) to merge duplicates within same person
    const servicesByPersonAndId = new Map<string, { serviceId: string; quantity: number; personIndex: number }>()
    personsData.forEach((person) => {
      person.serviceIds.forEach((id) => {
        const key = `${person.personIndex}:${id}`
        const existing = servicesByPersonAndId.get(key)
        if (existing) {
          existing.quantity += 1
        } else {
          servicesByPersonAndId.set(key, { serviceId: id, quantity: 1, personIndex: person.personIndex })
        }
      })
    })

    const bookingServicesCreate = Array.from(servicesByPersonAndId.values()).map(({ serviceId, quantity, personIndex }) => {
      const s = serviceMap.get(serviceId)!
      return { serviceId: s.id, price: s.price * quantity, quantity, personIndex }
    })

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        locationId,
        userId: user.id,
        date: new Date(`${dateStr}T00:00:00.000Z`),
        timeSlot,
        durationMinutes: totalDurationMinutes,
        groupSize: bookingGroupSize,
        status: 'BOOKED',
        notes: customerDetails.notes,
        token: bookingToken,
        services: {
          create: bookingServicesCreate,
        },
        payment: {
          create: {
            amount: advanceAmount,
            totalAmount,
            amountPaid: 0,
            onlineAmount: 0,
            cashAmount: 0,
            paymentType: paymentType === 'ADVANCE' ? 'ADVANCE' : paymentType === 'FREE' ? 'FREE' : 'FULL',
            paymentStatus: isFreeBooking ? 'FREE' : 'PENDING',
          },
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        payment: true,
      },
    })

    // FREE booking: no payment gateway needed
    if (isFreeBooking) {
      sendBookingNotification(user.mobile, buildBookingNotificationPayload(
        { token: booking.token, date: booking.date, timeSlot: booking.timeSlot, services: booking.services, user: { name: user.name, mobile: user.mobile } },
        totalAmount
      ), 'customer').catch((e) => console.error('Notify customer failed:', e))

      return NextResponse.json({ bookingId: booking.id, token: bookingToken, noPayment: true })
    }

    // Use test payment only when explicitly enabled; otherwise try PhonePe (works in dev if credentials set)
    const useTestPayment = process.env.USE_TEST_PAYMENT === 'true'
    let paymentUrl: string | null = null
    if (!useTestPayment) {
      paymentUrl = await initiatePhonePePayment(booking.id, advanceAmount)
    }

    // Notify customer and staff: WhatsApp (template) or SMS with booking details + bill link
    const totalAmountForNotify = booking.payment?.totalAmount ?? totalAmount
    const payload = buildBookingNotificationPayload(
      {
        token: booking.token,
        date: booking.date,
        timeSlot: booking.timeSlot,
        services: booking.services,
        user: { name: user.name, mobile: user.mobile },
      },
      totalAmountForNotify
    )
    sendBookingNotification(user.mobile, payload, 'customer').catch((e) =>
      console.error('Notify customer failed:', e)
    )
    // Staff WhatsApp (staff_booking_alert) is sent after payment succeeds — see notifyStaffBookingManagersAfterPayment in payment callback/webhook.

    
    return NextResponse.json({
      bookingId: booking.id,
      token: bookingToken,
      paymentUrl,
      useTestPayment: useTestPayment,
    })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}
