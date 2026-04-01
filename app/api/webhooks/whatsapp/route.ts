/**
 * WhatsApp Cloud API Webhook
 *
 * GET  — verification handshake (Meta calls this when you register the webhook)
 * POST — incoming events: new messages + delivery status updates
 *
 * Set in .env:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_secret_token
 *
 * Register at: Meta Developer Console → WhatsApp → Configuration → Webhook
 * URL: https://your-domain.com/api/webhooks/whatsapp
 * Subscribed fields: messages
 */

import { NextResponse } from 'next/server'
import { saveInboundMessage, updateMessageStatus } from '@/lib/whatsapp-chat'

export const dynamic = 'force-dynamic'

// ─── GET: Webhook verification ────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[WhatsApp Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not set')
    return new Response('Not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verified')
    return new Response(challenge ?? '', { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

// ─── POST: Incoming events ────────────────────────────────────────────────────

type WaTextMessage = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { caption?: string }
  video?: { caption?: string }
  document?: { filename?: string }
  audio?: Record<string, unknown>
  sticker?: Record<string, unknown>
  location?: Record<string, unknown>
  contacts?: unknown[]
  interactive?: { type: string; button_reply?: { title: string }; list_reply?: { title: string } }
}

type WaStatusUpdate = {
  id: string
  recipient_id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
}

type WaValue = {
  messaging_product: string
  metadata?: { display_phone_number: string; phone_number_id: string }
  contacts?: Array<{ profile: { name: string }; wa_id: string }>
  messages?: WaTextMessage[]
  statuses?: WaStatusUpdate[]
}

function extractMessageBody(msg: WaTextMessage): { body: string; type: string } {
  switch (msg.type) {
    case 'text':
      return { body: msg.text?.body ?? '', type: 'text' }
    case 'image':
      return { body: msg.image?.caption ? `[Image: ${msg.image.caption}]` : '[Image]', type: 'image' }
    case 'video':
      return { body: msg.video?.caption ? `[Video: ${msg.video.caption}]` : '[Video]', type: 'video' }
    case 'audio':
      return { body: '[Voice message]', type: 'audio' }
    case 'document':
      return {
        body: msg.document?.filename ? `[Document: ${msg.document.filename}]` : '[Document]',
        type: 'document',
      }
    case 'sticker':
      return { body: '[Sticker]', type: 'sticker' }
    case 'location':
      return { body: '[Location]', type: 'location' }
    case 'interactive': {
      const title =
        msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '[Interactive]'
      return { body: title, type: 'text' }
    }
    default:
      return { body: `[${msg.type}]`, type: msg.type }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ received: true })
    }

    const entries = body.entry ?? []

    for (const entry of entries) {
      const changes = entry.changes ?? []

      for (const change of changes) {
        if (change.field !== 'messages') continue
        const value: WaValue = change.value

        // ── Incoming messages ──────────────────────────────────────────────
        if (value.messages?.length) {
          const contactsMap: Record<string, string> = {}
          for (const c of value.contacts ?? []) {
            contactsMap[c.wa_id] = c.profile.name
          }

          for (const msg of value.messages) {
            try {
              const { body: msgBody, type: msgType } = extractMessageBody(msg)
              if (!msgBody) continue // skip empty

              await saveInboundMessage({
                mobile: msg.from,
                body: msgBody,
                waMessageId: msg.id,
                messageType: msgType,
                customerName: contactsMap[msg.from],
              })
            } catch (err) {
              console.error('[WhatsApp Webhook] Failed to save message', msg.id, err)
            }
          }
        }

        // ── Delivery status updates ───────────────────────────────────────
        if (value.statuses?.length) {
          for (const status of value.statuses) {
            try {
              await updateMessageStatus(status.id, status.status)
            } catch (err) {
              console.error('[WhatsApp Webhook] Failed to update status', status.id, err)
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[WhatsApp Webhook] Parse error', err)
    // Always return 200 to WhatsApp or it retries
    return NextResponse.json({ received: true })
  }
}
