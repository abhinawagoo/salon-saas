import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    const bookings = await prisma.booking.findMany({
      where: {
        ...(locationId ? { locationId } : {}),
        payment: { paymentStatus: { in: ['COMPLETED', 'FREE'] } },
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
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
        payment: {
          select: {
            paymentStatus: true,
            amount: true,
            paymentType: true,
            totalAmount: true,
            amountPaid: true,
            onlineAmount: true,
            cashAmount: true,
          },
        },
      },
      orderBy: [
        {
          date: 'desc',
        },
        {
          timeSlot: 'asc',
        },
      ],
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
