import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { staffId } = await request.json()

    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { staffId: staffId ?? null },
      select: { id: true, staffId: true, staff: { select: { id: true, name: true } } },
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error assigning staff:', error)
    return NextResponse.json({ error: 'Failed to assign staff' }, { status: 500 })
  }
}
