import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { normalizeMobileForDb } from '@/lib/phone'

function generateToken() {
  return (
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    Math.random().toString(36).substring(2, 10).toUpperCase()
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      customerName,
      customerMobile,
      date,       // YYYY-MM-DD
      timeSlot,   // HH:MM
      locationId,
      serviceIds, // string[]
      notes,
    } = body

    if (!customerName || !customerMobile || !date || !timeSlot || !locationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const mobile = normalizeMobileForDb(customerMobile)

    // 1. Upsert customer user
    let user = await prisma.user.findUnique({ where: { mobile } })
    if (!user) {
      user = await prisma.user.create({
        data: { name: customerName.trim(), mobile, role: 'CUSTOMER' },
      })
    } else {
      // Update name if changed
      if (user.name !== customerName.trim()) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: customerName.trim() },
        })
      }
    }

    // 2. Fetch services
    const services =
      Array.isArray(serviceIds) && serviceIds.length > 0
        ? await prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
            select: { id: true, price: true, duration: true },
          })
        : []

    // 3. Calculate total duration and amount
    const durationMinutes = services.reduce((sum, s) => sum + s.duration, 0) || 30
    const totalAmount = services.reduce((sum, s) => sum + s.price, 0)

    // 4. Create booking — use UTC midnight to match how bookings are queried
    const bookingDate = new Date(`${date}T00:00:00.000Z`)
    const token = generateToken()

    const booking = await prisma.booking.create({
      data: {
        locationId,
        userId: user.id,
        date: bookingDate,
        timeSlot,
        durationMinutes,
        groupSize: 1,
        status: 'BOOKED',
        notes: notes?.trim() || null,
        token,
        services: {
          create: services.map(s => ({
            serviceId: s.id,
            price: s.price,
            quantity: 1,
            personIndex: 0,
          })),
        },
        payment: {
          create: {
            amount: 0,
            totalAmount,
            amountPaid: 0,
            onlineAmount: 0,
            cashAmount: 0,
            paymentType: 'FULL',
            paymentStatus: 'FREE',
          },
        },
      },
      include: {
        user: { select: { id: true, name: true, mobile: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, duration: true, price: true } },
          },
        },
        payment: { select: { paymentStatus: true, totalAmount: true, amountPaid: true, cashAmount: true, onlineAmount: true } },
      },
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar booking:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
}
