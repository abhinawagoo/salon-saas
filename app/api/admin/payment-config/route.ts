import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePaymentConfig, validatePaymentConfig, DEFAULT_PAYMENT_CONFIG, type PaymentConfig } from '@/lib/paymentConfig'

export const dynamic = 'force-dynamic'

// GET /api/admin/payment-config
// Returns current payment config (parsed + defaulted)
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{ paymentConfigJson: string | null }>>`
      SELECT "paymentConfigJson" FROM "SiteCustomization" WHERE id = 1 LIMIT 1
    `
    const config = parsePaymentConfig(rows[0]?.paymentConfigJson)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[admin payment-config GET]', err)
    // Return default config rather than an error so the page always renders
    return NextResponse.json(DEFAULT_PAYMENT_CONFIG)
  }
}

// PUT /api/admin/payment-config
// Body: PaymentConfig
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as PaymentConfig

    const validationError = validatePaymentConfig(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const json = JSON.stringify(body)

    // Use raw SQL to avoid any ORM schema-mismatch issues between cold-start
    // and freshly migrated columns (avoids stale Prisma client cache in dev).
    await prisma.$executeRaw`
      INSERT INTO "SiteCustomization" (id, "brandName", "menuLabel", "paymentConfigJson", "updatedAt")
      VALUES (1, 'Salon', 'Services', ${json}, now())
      ON CONFLICT (id) DO UPDATE SET "paymentConfigJson" = ${json}, "updatedAt" = now()
    `

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[admin payment-config PUT]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
