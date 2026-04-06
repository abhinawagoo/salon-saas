import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseBusinessHours, getDayConfig } from '@/lib/slots'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date       = searchParams.get('date')       // YYYY-MM-DD
    const locationId = searchParams.get('locationId')

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 })
    }

    // Use UTC-anchored midnight so the range always matches bookings stored via new Date("YYYY-MM-DD")
    const dayStartUTC = new Date(`${date}T00:00:00.000Z`)
    const dayEndUTC   = new Date(`${date}T23:59:59.999Z`)

    // Show ALL bookings for the day — customer, admin, staff created — all synced
    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: dayStartUTC, lte: dayEndUTC },
        ...(locationId ? { locationId } : {}),
      },
      include: {
        user:  { select: { id: true, name: true, mobile: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, duration: true, price: true } },
          },
        },
        payment: {
          select: {
            paymentStatus: true,
            paymentType: true,
            totalAmount: true,
            amountPaid: true,
            cashAmount: true,
            onlineAmount: true,
          },
        },
        location: {
          select: { id: true, name: true, businessHoursJson: true },
        },
      },
      orderBy: { timeSlot: 'asc' },
    })

    // Derive business hours for the selected date
    let businessHours = { openTime: '09:00', closeTime: '20:00' }
    const locData = bookings[0]?.location
    const hoursJson = locData?.businessHoursJson

    const resolveHours = (json: string) => {
      try {
        const parsed = parseBusinessHours(json)
        const cfg    = getDayConfig(parsed, dayStartUTC.getUTCDay())
        if (cfg.openTime)  businessHours.openTime  = cfg.openTime
        if (cfg.closeTime) businessHours.closeTime = cfg.closeTime
      } catch { /* use defaults */ }
    }

    if (hoursJson) {
      resolveHours(hoursJson)
    } else if (locationId) {
      const loc = await prisma.location.findUnique({
        where: { id: locationId },
        select: { businessHoursJson: true },
      })
      if (loc?.businessHoursJson) resolveHours(loc.businessHoursJson)
    }

    return NextResponse.json({ bookings, businessHours })
  } catch (error) {
    console.error('Error fetching calendar data:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}
