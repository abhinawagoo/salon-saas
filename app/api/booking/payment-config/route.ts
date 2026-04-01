import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  parsePaymentConfig,
  getEnabledOptions,
  calcOptionAmount,
  calcOptionDescription,
} from '@/lib/paymentConfig'

export const dynamic = 'force-dynamic'

// GET /api/booking/payment-config?total=1500
// Returns enabled payment options with calculated amounts for the given total.
// Used by the booking payment page to dynamically render the options.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const total = parseFloat(searchParams.get('total') || '0')

    const rows = await prisma.$queryRaw<Array<{ paymentConfigJson: string | null }>>`
      SELECT "paymentConfigJson" FROM "SiteCustomization" WHERE id = 1 LIMIT 1
    `
    const config = parsePaymentConfig(rows[0]?.paymentConfigJson)
    const enabled = getEnabledOptions(config)

    const options = enabled.map((opt) => ({
      type: opt.type,
      label: opt.label,
      amount: calcOptionAmount(opt, total),
      description: calcOptionDescription(opt, total),
      ...(opt.type === 'ADVANCE'
        ? { advanceMode: opt.mode, advanceValue: opt.value }
        : {}),
    }))

    return NextResponse.json({ options })
  } catch (err) {
    console.error('[payment-config]', err)
    // Fall back to full payment only so booking is never broken
    return NextResponse.json({
      options: [
        {
          type: 'FULL',
          label: 'Pay in Full',
          amount: parseFloat(new URL(request.url).searchParams.get('total') || '0'),
          description: 'Pay complete amount now',
        },
      ],
    })
  }
}
