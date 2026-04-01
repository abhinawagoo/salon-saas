import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeMobileForDb } from '@/lib/phone'
import { createAuthToken, getAuthCookieOptions, COOKIE_NAME } from '@/lib/auth-jwt'
import { nanoid } from 'nanoid'

const DEV_OTP = '1234'
// When USE_WHATSAPP_OTP=true, verify against DB (no 1234 bypass)
const USE_WHATSAPP_OTP = process.env.USE_WHATSAPP_OTP === 'true'
// DEMO_MODE=true allows 1234 bypass even in production (for demos)
const DEV_BYPASS = (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true') && !USE_WHATSAPP_OTP

type UserRow = { id: string; name: string; mobile: string; role: string }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mobile = normalizeMobileForDb(body.mobile || '')
    const otp = String(body.otp || '').trim()

    if (mobile.length < 10 || otp.length !== 4) {
      return NextResponse.json({ error: 'Invalid mobile or OTP' }, { status: 400 })
    }

    if (DEV_BYPASS && otp === DEV_OTP) {
      // Dev bypass: no OtpRequest; use raw SQL so we don't touch missing User.email / marketingConsent
      const existing = await prisma.$queryRaw<UserRow[]>`
        SELECT id, name, mobile, role FROM "User" WHERE mobile = ${mobile} LIMIT 1
      `
      let user: UserRow
      if (existing.length > 0) {
        user = existing[0]
      } else {
        const id = nanoid(24)
        await prisma.$executeRaw`
          INSERT INTO "User" (id, name, mobile, role, "createdAt", "updatedAt")
          VALUES (${id}, 'Guest', ${mobile}, 'CUSTOMER', now(), now())
        `
        user = { id, name: 'Guest', mobile, role: 'CUSTOMER' }
      }
      const token = createAuthToken({
        userId: user.id,
        mobile: user.mobile,
        name: user.name,
        role: user.role,
      })
      const res = NextResponse.json({
        user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
      })
      res.cookies.set(COOKIE_NAME, token, getAuthCookieOptions())
      return res
    }

    const record = await prisma.otpRequest.findFirst({
      where: { mobile, otp },
      orderBy: { createdAt: 'desc' },
    })

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    await prisma.otpRequest.deleteMany({ where: { mobile } })

    let user = await prisma.user.findUnique({ where: { mobile } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Guest',
          mobile,
          role: 'CUSTOMER',
          marketingConsent: body.marketingConsent !== false,
        },
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { marketingConsent: body.marketingConsent !== false },
      })
    }

    const token = createAuthToken({
      userId: user.id,
      mobile: user.mobile,
      name: user.name,
      role: user.role,
    })

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role },
    })
    res.cookies.set(COOKIE_NAME, token, getAuthCookieOptions())
    return res
  } catch (e) {
    console.error('OTP verify error:', e)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
