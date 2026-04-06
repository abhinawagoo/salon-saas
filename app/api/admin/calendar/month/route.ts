import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export const dynamic = 'force-dynamic'

// Returns booking counts per day for a given month.
// Response: { "2025-04-03": 4, "2025-04-07": 2, ... }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year       = parseInt(searchParams.get('year')  || String(new Date().getFullYear()), 10)
    const month      = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10)
    const locationId = searchParams.get('locationId')

    // UTC-anchored so it matches how bookings are stored (new Date("YYYY-MM-DD") = UTC midnight)
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const monthEnd   = new Date(Date.UTC(year, month - 1 + 1, 0, 23, 59, 59, 999))

    const bookings = await prisma.booking.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        status: { not: 'CANCELLED' },
        ...(locationId ? { locationId } : {}),
      },
      select: { date: true },
    })

    const counts: Record<string, number> = {}
    for (const b of bookings) {
      const key = format(b.date, 'yyyy-MM-dd')
      counts[key] = (counts[key] || 0) + 1
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error('Error fetching month bookings:', error)
    return NextResponse.json({}, { status: 500 })
  }
}
