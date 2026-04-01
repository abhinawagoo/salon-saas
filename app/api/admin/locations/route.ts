import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseStaffBookingNotifyPhones } from '@/lib/phone'

/** GET: List all locations (admin) */
export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}

/** POST: Create a location */
export async function POST(request: NextRequest) {
  try {
    const count = await prisma.location.count()
    const body = await request.json()
    const name = (body.name || '').trim()
    const address = (body.address ?? '').trim() || undefined
    const mobile = (body.mobile ?? '').toString().trim() || null
    const imageUrl = (body.imageUrl ?? '').toString().trim() || null
    const businessHoursJson = body.businessHoursJson !== undefined && body.businessHoursJson !== null
      ? String(body.businessHoursJson).trim() || null
      : null
    const closedDatesJson = body.closedDatesJson !== undefined && body.closedDatesJson !== null
      ? String(body.closedDatesJson).trim() || null
      : null
    const concurrentSlots = Math.max(1, Math.min(20, Number(body.concurrentSlots) || 1))
    let staffBookingNotifyPhones: string | null = null
    if (body.staffBookingNotifyPhones !== undefined) {
      const parsed =
        typeof body.staffBookingNotifyPhones === 'string'
          ? parseStaffBookingNotifyPhones(body.staffBookingNotifyPhones)
          : parseStaffBookingNotifyPhones(JSON.stringify(body.staffBookingNotifyPhones))
      staffBookingNotifyPhones = JSON.stringify(parsed)
    }
    if (!name) {
      return NextResponse.json(
        { error: 'Location name is required' },
        { status: 400 }
      )
    }
    const slug =
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || `location-${count + 1}`
    const existing = await prisma.location.findUnique({ where: { slug } })
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug
    const location = await prisma.location.create({
      data: {
        name,
        slug: finalSlug,
        address: address || null,
        mobile,
        imageUrl,
        businessHoursJson,
        closedDatesJson,
        staffBookingNotifyPhones,
        concurrentSlots,
        isActive: true,
      },
    })
    return NextResponse.json(location)
  } catch (error) {
    console.error('Error creating location:', error)
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    )
  }
}
