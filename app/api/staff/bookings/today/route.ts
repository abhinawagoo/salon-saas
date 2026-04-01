import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    const whereToday = {
      date: { gte: todayStart, lte: todayEnd },
      status: { not: 'CANCELLED' as const },
      payment: { paymentStatus: { in: ['COMPLETED', 'FREE'] as const } },
      ...(locationId ? { locationId } : {}),
    }

    const bookings = await prisma.booking.findMany({
      where: whereToday,
      include: {
        location: { select: { id: true, name: true, address: true, mobile: true, imageUrl: true } },
        user: {
          select: {
            name: true,
            mobile: true,
          },
        },
        services: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        timeSlot: 'asc',
      },
    })

    const whereUpcoming = {
      date: { gt: todayEnd },
      status: { not: 'CANCELLED' as const },
      payment: { paymentStatus: { in: ['COMPLETED', 'FREE'] as const } },
      ...(locationId ? { locationId } : {}),
    }

    const upcomingBookings = await prisma.booking.findMany({
      where: whereUpcoming,
      include: {
        location: { select: { id: true, name: true, address: true, mobile: true, imageUrl: true } },
        user: {
          select: {
            name: true,
            mobile: true,
          },
        },
        services: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
        payment: true,
      },
      orderBy: {
        date: 'asc',
      },
      take: 20,
    })

    return NextResponse.json([...bookings, ...upcomingBookings])
  } catch (error) {
    console.error('Error fetching today bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
