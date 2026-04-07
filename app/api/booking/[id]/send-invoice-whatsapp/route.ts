import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendInvoiceWhatsApp } from '@/lib/whatsapp-cloud'
import { recordSystemMessage } from '@/lib/whatsapp-chat'
import { getOrAssignBillNo } from '@/lib/billNo'
import { getPublicInvoiceUrl } from '@/lib/invoiceUrl'
import { normalizeMobileForDb } from '@/lib/phone'
import { formatCurrencyPdf } from '@/lib/currency'

export const dynamic = 'force-dynamic'

/**
 * Staff/admin: resend invoice/receipt template (same as post-payment) to customer mobile or an override.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const bookingId = params.id
    let body: { mobile?: string } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        token: true,
        date: true,
        timeSlot: true,
        user: { select: { name: true, mobile: true } },
        payment: {
          select: {
            paymentStatus: true,
            totalAmount: true,
            amountPaid: true,
          },
        },
      },
    })

    if (!booking?.payment) {
      return NextResponse.json({ ok: false, error: 'Booking or payment not found' }, { status: 404 })
    }

    if (booking.payment.paymentStatus !== 'COMPLETED') {
      return NextResponse.json(
        { ok: false, error: 'Payment must be completed before sending invoice' },
        { status: 400 }
      )
    }

    const defaultMobile = normalizeMobileForDb(booking.user.mobile || '')
    const override = typeof body.mobile === 'string' ? normalizeMobileForDb(body.mobile) : ''
    const targetMobile = (override.length === 10 ? override : defaultMobile) || ''

    if (targetMobile.length !== 10) {
      return NextResponse.json({ ok: false, error: 'Invalid mobile number' }, { status: 400 })
    }

    if (!booking.token) {
      return NextResponse.json({ ok: false, error: 'Booking token missing' }, { status: 500 })
    }

    const waConfigured = !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
    if (!waConfigured) {
      return NextResponse.json({ ok: false, error: 'WhatsApp is not configured' }, { status: 503 })
    }

    const invoiceLink = getPublicInvoiceUrl(booking.token)
    const billNo = await getOrAssignBillNo(bookingId)
    const [p, siteConfig] = await Promise.all([
      prisma.payment.findFirst({ where: { bookingId } }),
      prisma.siteCustomization.findFirst({ select: { currency: true } }),
    ])
    const currency = siteConfig?.currency || 'EUR'
    const amountPaid = p?.amountPaid ?? 0
    const balanceDue = Math.max(0, (p?.totalAmount ?? 0) - (p?.amountPaid ?? 0))

    const result = await sendInvoiceWhatsApp(
      targetMobile,
      booking.user.name || 'Customer',
      amountPaid,
      new Date(),
      invoiceLink,
      {
        billNo,
        balanceDue,
        bookingToken: booking.token,
        appointmentDate: booking.date,
        appointmentTimeSlot: booking.timeSlot,
      }
    )

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'Failed to send WhatsApp message' },
        { status: 502 }
      )
    }

    // Record in unified chat DB
    await recordSystemMessage(targetMobile, `Invoice sent — Bill ${billNo} · ${formatCurrencyPdf(Math.round(amountPaid), currency, 0)} paid`, {
      customerName: booking.user.name || undefined,
      templateName: process.env.WHATSAPP_INVOICE_TEMPLATE_NAME || 'customer_invoice',
      refType: 'payment',
      refId: bookingId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('send-invoice-whatsapp error:', error)
    return NextResponse.json({ ok: false, error: 'Failed to send invoice' }, { status: 500 })
  }
}
