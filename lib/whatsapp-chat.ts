/**
 * lib/whatsapp-chat.ts
 * Unified WhatsApp chat layer.
 * - Saves every message to DB BEFORE sending (outbound).
 * - Saves incoming messages on webhook arrival.
 * - Updates delivery status from webhook events.
 *
 * All outbound helpers return { ok, messageId, error? }.
 * Call these instead of whatsapp-cloud.ts for tracked messages.
 */

import { prisma } from '@/lib/prisma'
import { toE164, normalizeMobileForDb } from '@/lib/phone'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function getWaConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  }
}

// ─── Low-level send (captures wamid) ──────────────────────────────────────────

async function sendRaw(
  to: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; waMessageId?: string; error?: string }> {
  const { token, phoneId } = getWaConfig()
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp not configured' }

  const url = `${GRAPH_API}/${phoneId}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>
      error?: { message?: string }
    }
    if (!res.ok) return { ok: false, error: data.error?.message || res.statusText }
    return { ok: true, waMessageId: data.messages?.[0]?.id }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ─── Conversation helpers ──────────────────────────────────────────────────────

export async function getOrCreateConversation(
  mobile: string,
  customerName?: string,
  userId?: string
) {
  const e164 = toE164(mobile) // "919876543210"

  return prisma.whatsAppConversation.upsert({
    where: { mobile: e164 },
    update: {
      ...(customerName ? { customerName } : {}),
      ...(userId ? { userId } : {}),
    },
    create: {
      mobile: e164,
      customerName: customerName ?? null,
      userId: userId ?? null,
    },
  })
}

async function touchConversation(id: string, preview: string) {
  return prisma.whatsAppConversation.update({
    where: { id },
    data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 120) },
  })
}

// ─── Save helpers ─────────────────────────────────────────────────────────────

type OutboundOpts = {
  templateName?: string
  refType?: string
  refId?: string
  messageType?: string
}

async function saveOutbound(
  conversationId: string,
  body: string,
  senderType: 'agent' | 'system',
  opts?: OutboundOpts
) {
  return prisma.whatsAppMessage.create({
    data: {
      conversationId,
      direction: 'outbound',
      senderType,
      body,
      status: 'pending',
      messageType: opts?.messageType ?? 'text',
      templateName: opts?.templateName,
      refType: opts?.refType,
      refId: opts?.refId,
    },
  })
}

async function markSent(messageId: string, waMessageId: string) {
  return prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: { status: 'sent', waMessageId },
  })
}

async function markFailed(messageId: string) {
  return prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: { status: 'failed' },
  })
}

// ─── Public: Update delivery status (called from webhook) ─────────────────────

export async function updateMessageStatus(waMessageId: string, status: string) {
  return prisma.whatsAppMessage.updateMany({
    where: { waMessageId },
    data: { status },
  })
}

// ─── Public: Save incoming message (called from webhook) ──────────────────────

export async function saveInboundMessage(opts: {
  mobile: string
  body: string
  waMessageId: string
  messageType?: string
  customerName?: string
}) {
  const e164 = toE164(opts.mobile)
  const tenDigit = normalizeMobileForDb(opts.mobile)

  // Try to link to a registered User
  const user = await prisma.user.findFirst({
    where: { OR: [{ mobile: tenDigit }, { mobile: e164 }] },
    select: { id: true, name: true },
  })

  const resolvedName = opts.customerName || user?.name || undefined
  const conversation = await getOrCreateConversation(e164, resolvedName, user?.id ?? undefined)

  const message = await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      waMessageId: opts.waMessageId,
      direction: 'inbound',
      senderType: 'user',
      body: opts.body,
      messageType: opts.messageType ?? 'text',
      status: 'received',
    },
  })

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: opts.body.slice(0, 120),
      unreadCount: { increment: 1 },
      ...(resolvedName ? { customerName: resolvedName } : {}),
      ...(user?.id ? { userId: user.id } : {}),
      isResolved: false,
    },
  })

  return { message, conversation }
}

// ─── Public: Record a message that was already sent via whatsapp-cloud.ts ─────
// Use this as a compatibility shim to populate the chat DB from existing send flows.

export async function recordSystemMessage(
  mobile: string,
  body: string,
  opts?: {
    customerName?: string
    userId?: string
    templateName?: string
    refType?: string
    refId?: string
  }
): Promise<void> {
  try {
    const e164 = toE164(mobile)
    const conv = await getOrCreateConversation(e164, opts?.customerName, opts?.userId)
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conv.id,
        direction: 'outbound',
        senderType: 'system',
        body: body.slice(0, 4096),
        status: 'sent', // already sent; wamid unknown
        templateName: opts?.templateName,
        refType: opts?.refType,
        refId: opts?.refId,
      },
    })
    await touchConversation(conv.id, body)
  } catch (err) {
    // Non-fatal: don't break the calling route if DB write fails
    console.error('[whatsapp-chat] recordSystemMessage failed', err)
  }
}

// ─── Public: Send + save text (agent or system) ───────────────────────────────

export async function sendChatText(
  mobile: string,
  body: string,
  senderType: 'agent' | 'system',
  opts?: {
    customerName?: string
    userId?: string
    refType?: string
    refId?: string
  }
): Promise<{ ok: boolean; messageId: string; error?: string }> {
  const e164 = toE164(mobile)
  const conv = await getOrCreateConversation(e164, opts?.customerName, opts?.userId)

  // Save BEFORE sending
  const dbMsg = await saveOutbound(conv.id, body, senderType, {
    refType: opts?.refType,
    refId: opts?.refId,
  })
  await touchConversation(conv.id, body)

  const result = await sendRaw(e164, { type: 'text', text: { body } })

  if (result.ok && result.waMessageId) {
    await markSent(dbMsg.id, result.waMessageId)
  } else {
    await markFailed(dbMsg.id)
  }

  return { ok: result.ok, messageId: dbMsg.id, error: result.error }
}

// ─── Public: Send + save template (system typically) ─────────────────────────

export async function sendChatTemplate(
  mobile: string,
  templateName: string,
  bodyParams: string[],
  senderType: 'agent' | 'system',
  opts?: {
    customerName?: string
    userId?: string
    languageCode?: string
    refType?: string
    refId?: string
    /** Human-readable preview stored in DB body field */
    bodyPreview?: string
  }
): Promise<{ ok: boolean; messageId: string; error?: string }> {
  const e164 = toE164(mobile)
  const conv = await getOrCreateConversation(e164, opts?.customerName, opts?.userId)

  const bodyText =
    opts?.bodyPreview ?? `[Template: ${templateName}] ${bodyParams.slice(0, 3).join(' | ')}`

  // Save BEFORE sending
  const dbMsg = await saveOutbound(conv.id, bodyText, senderType, {
    templateName,
    refType: opts?.refType,
    refId: opts?.refId,
  })
  await touchConversation(conv.id, bodyText)

  const lang = opts?.languageCode ?? process.env.WHATSAPP_TEMPLATE_LANG ?? 'en'
  const result = await sendRaw(e164, {
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  })

  if (result.ok && result.waMessageId) {
    await markSent(dbMsg.id, result.waMessageId)
  } else {
    await markFailed(dbMsg.id)
  }

  return { ok: result.ok, messageId: dbMsg.id, error: result.error }
}
