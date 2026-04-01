import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPhonePeOrderStatus } from '@/lib/phonepe'
import { sendInvoiceWhatsApp } from '@/lib/whatsapp-cloud'
import { recordSystemMessage } from '@/lib/whatsapp-chat'
import { getOrAssignBillNo } from '@/lib/billNo'
import { getPublicInvoiceUrl } from '@/lib/invoiceUrl'
import { notifyStaffBookingManagersAfterPayment } from '@/lib/notify'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

// PhonePe PG v2: user is redirected here after payment. We use Order Status API to confirm.
// Use APP_URL for redirects so users always land on the configured domain (not Vercel preview URL).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('bookingId')

  if (!bookingId) {
    return NextResponse.redirect(`${APP_URL}/`)
  }

  const base = APP_URL

  try {
    const status = await getPhonePeOrderStatus(bookingId)
    const state = status?.state?.toUpperCase()

    const payment = await prisma.payment.findFirst({
      where: { bookingId },
      include: {
        booking: {
          select: {
            token: true,
            date: true,
            timeSlot: true,
            user: { select: { name: true, mobile: true } },
          },
        },
      },
    })
    if (!payment) {
      return NextResponse.redirect(`${base}/booking/payment?error=payment_not_found`)
    }

    const isSuccess = state === 'COMPLETED' || state === 'PAID'
    const alreadyCompleted = payment.paymentStatus === 'COMPLETED'
    if (isSuccess) {
      // Idempotent: only update if not already completed (avoids double-count when webhook + redirect both fire)
      if (!alreadyCompleted) {
        const paidAmount = payment.amount
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: 'COMPLETED',
            gatewayReference: status?.orderId ?? undefined,
            gatewayResponse: JSON.stringify(status),
            amountPaid: paidAmount,
            onlineAmount: paidAmount,
          },
        })
      }
      // Staff + customer invoice on first completion only (webhook may have already run)
      const token = payment.booking?.token
      const user = payment.booking?.user
      const waConfigured = !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
      if (isSuccess && !alreadyCompleted && waConfigured) {
        void (async () => {
          try {
            await notifyStaffBookingManagersAfterPayment(bookingId)
          } catch (e) {
            console.error('Staff booking WhatsApp failed:', e)
          }
        })()
      }
      if (isSuccess && !alreadyCompleted && token && user?.mobile && waConfigured) {
        const invoiceLink = getPublicInvoiceUrl(token)
        const amountPaid = payment.amount
        void (async () => {
          try {
            const billNo = await getOrAssignBillNo(bookingId)
            const p = await prisma.payment.findFirst({ where: { bookingId } })
            const balanceDue = Math.max(0, (p?.totalAmount ?? 0) - (p?.amountPaid ?? 0))
            await sendInvoiceWhatsApp(user.mobile, user.name || 'Customer', amountPaid, new Date(), invoiceLink, {
              billNo,
              balanceDue,
              bookingToken: token,
              appointmentDate: payment.booking?.date,
              appointmentTimeSlot: payment.booking?.timeSlot,
            })
            await recordSystemMessage(
              user.mobile,
              `Invoice sent — Bill ${billNo} · ₹${Math.round(amountPaid)} paid`,
              {
                customerName: user.name || undefined,
                templateName: process.env.WHATSAPP_INVOICE_TEMPLATE_NAME || 'customer_invoice',
                refType: 'payment',
                refId: bookingId,
              }
            )
          } catch (e) {
            console.error('Invoice WhatsApp failed:', e)
          }
        })()
      }
      return NextResponse.redirect(`${base}/booking/confirmation?bookingId=${bookingId}&payment=completed`)
    }

    if (state === 'FAILED' || state === 'CANCELLED' || state === 'EXPIRED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          paymentStatus: 'FAILED',
          gatewayResponse: JSON.stringify(status),
        },
      })
    }

    return NextResponse.redirect(`${base}/booking/payment?error=payment_failed&bookingId=${bookingId}`)
  } catch (e) {
    console.error('Payment callback error:', e)
    return NextResponse.redirect(`${base}/booking/payment?error=callback_failed&bookingId=${bookingId}`)
  }
}
