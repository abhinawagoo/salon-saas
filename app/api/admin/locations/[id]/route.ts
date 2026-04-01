import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFromR2ByUrl } from '@/lib/r2'
import { parseStaffBookingNotifyPhones } from '@/lib/phone'

/** PATCH: Update location name and address (slug left unchanged) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const name = (body.name ?? '').toString().trim()
    const address = body.address !== undefined ? (body.address ?? '').toString().trim() || null : undefined
    const mobile = body.mobile !== undefined ? (body.mobile ?? '').toString().trim() || null : undefined
    const imageUrl = body.imageUrl !== undefined ? (body.imageUrl ?? '').toString().trim() || null : undefined
    const businessHoursJson = body.businessHoursJson !== undefined && body.businessHoursJson !== null
      ? String(body.businessHoursJson).trim() || null
      : undefined
    const closedDatesJson = body.closedDatesJson !== undefined && body.closedDatesJson !== null
      ? String(body.closedDatesJson).trim() || null
      : undefined
    let staffBookingNotifyPhones: string | null | undefined
    if (body.staffBookingNotifyPhones !== undefined) {
      const parsed =
        typeof body.staffBookingNotifyPhones === 'string'
          ? parseStaffBookingNotifyPhones(body.staffBookingNotifyPhones)
          : parseStaffBookingNotifyPhones(JSON.stringify(body.staffBookingNotifyPhones))
      staffBookingNotifyPhones = JSON.stringify(parsed)
    }
    const concurrentSlots = body.concurrentSlots !== undefined
      ? Math.max(1, Math.min(20, Number(body.concurrentSlots) || 1))
      : undefined

    const updateData: {
      name?: string
      address?: string | null
      mobile?: string | null
      imageUrl?: string | null
      businessHoursJson?: string | null
      closedDatesJson?: string | null
      staffBookingNotifyPhones?: string | null
      concurrentSlots?: number
    } = {}
    if (name) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (mobile !== undefined) updateData.mobile = mobile
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (businessHoursJson !== undefined) updateData.businessHoursJson = businessHoursJson
    if (closedDatesJson !== undefined) updateData.closedDatesJson = closedDatesJson
    if (staffBookingNotifyPhones !== undefined) updateData.staffBookingNotifyPhones = staffBookingNotifyPhones
    if (concurrentSlots !== undefined) updateData.concurrentSlots = concurrentSlots

    if (imageUrl !== undefined) {
      const existing = await prisma.location.findUnique({
        where: { id },
        select: { imageUrl: true },
      })
      const newUrl = (imageUrl ?? '').toString().trim() || null
      if (existing?.imageUrl && existing.imageUrl !== newUrl) {
        await deleteFromR2ByUrl(existing.imageUrl)
      }
    }

    const location = await prisma.location.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(location)
  } catch (error) {
    console.error('Error updating location:', error)
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    )
  }
}
