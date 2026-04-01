import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/crm/customers?filter=all|recent|lapsed|new&locationId=&q=
// Returns users with booking stats for CRM targeting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const locationId = searchParams.get('locationId') || ''
    const q = (searchParams.get('q') || '').trim()

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Build booking where clause based on location filter
    const bookingWhere: Record<string, unknown> = {
      payment: { paymentStatus: 'COMPLETED' },
    }
    if (locationId) bookingWhere.locationId = locationId

    // Get all customers (role CUSTOMER) with their booking history
    const users = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { mobile: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        mobile: true,
        createdAt: true,
        marketingConsent: true,
        bookings: {
          where: bookingWhere,
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            date: true,
            locationId: true,
            location: { select: { name: true } },
          },
        },
        _count: {
          select: {
            bookings: {
              where: bookingWhere,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Map to flat structure with computed fields
    const mapped = users.map((u) => {
      const lastBooking = u.bookings[0] ?? null
      const lastBookingDate = lastBooking?.date ?? null
      const totalBookings = u._count.bookings
      const daysSinceLastBooking = lastBookingDate
        ? Math.floor((now.getTime() - new Date(lastBookingDate).getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: u.id,
        name: u.name,
        mobile: u.mobile,
        createdAt: u.createdAt,
        marketingConsent: u.marketingConsent,
        totalBookings,
        lastBookingDate,
        lastLocationName: lastBooking?.location?.name ?? null,
        daysSinceLastBooking,
      }
    })

    // Apply filter
    let filtered = mapped
    if (filter === 'recent') {
      // Booked within last 30 days
      filtered = mapped.filter(
        (u) => u.lastBookingDate && new Date(u.lastBookingDate) >= thirtyDaysAgo
      )
    } else if (filter === 'lapsed') {
      // Last booking > 60 days ago
      filtered = mapped.filter(
        (u) =>
          u.lastBookingDate && new Date(u.lastBookingDate) < sixtyDaysAgo
      )
    } else if (filter === 'new') {
      // Registered within last 30 days
      filtered = mapped.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo)
    } else if (filter === 'nobooking') {
      // Registered but never booked
      filtered = mapped.filter((u) => u.totalBookings === 0)
    }

    return NextResponse.json({ customers: filtered, total: filtered.length })
  } catch (err) {
    console.error('[CRM customers]', err)
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
  }
}
