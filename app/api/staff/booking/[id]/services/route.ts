import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// POST /api/staff/booking/[id]/services
// Body: { serviceIds: string[] }
// Adds services to an existing booking, merging duplicates by incrementing quantity.
// Updates Payment.totalAmount to reflect the new total.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = params
    const body = await request.json()
    const { serviceIds } = body as { serviceIds: string[] }

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json({ error: 'serviceIds array is required' }, { status: 400 })
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    })
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Validate all service IDs
    const uniqueIds = [...new Set(serviceIds)]
    const services = await prisma.service.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
    })
    const serviceMap = new Map(services.map((s) => [s.id, s]))
    const invalidIds = uniqueIds.filter((id) => !serviceMap.has(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({ error: 'Some services are invalid or inactive' }, { status: 400 })
    }

    // Count how many of each service to add
    const serviceCountMap = new Map<string, number>()
    for (const id of serviceIds) {
      serviceCountMap.set(id, (serviceCountMap.get(id) ?? 0) + 1)
    }

    // Upsert into BookingService; conflict on (bookingId, serviceId, personIndex=0)
    // increments quantity and price in-place
    for (const [serviceId, qty] of serviceCountMap.entries()) {
      const unitPrice = serviceMap.get(serviceId)!.price
      const addedPrice = unitPrice * qty
      await prisma.$executeRaw`
        INSERT INTO "BookingService" (id, "bookingId", "serviceId", price, quantity, "personIndex", "createdAt")
        VALUES (gen_random_uuid()::text, ${bookingId}, ${serviceId}, ${addedPrice}, ${qty}, 0, now())
        ON CONFLICT ("bookingId", "serviceId", "personIndex") DO UPDATE
          SET quantity = "BookingService".quantity + ${qty},
              price    = "BookingService".price + ${addedPrice}
      `
    }

    // Recalculate totalAmount from all BookingService rows
    const allServices = await prisma.bookingService.findMany({ where: { bookingId } })
    const newTotal = allServices.reduce((sum, bs) => sum + bs.price, 0)

    if (booking.payment) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: { totalAmount: newTotal },
      })
    }

    // Return updated booking with full details
    const updated = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        location: { select: { id: true, name: true, address: true, mobile: true, imageUrl: true } },
        user: { select: { name: true, mobile: true } },
        services: { include: { service: { select: { name: true } } } },
        payment: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error adding services to booking:', error)
    return NextResponse.json({ error: 'Failed to add services' }, { status: 500 })
  }
}
