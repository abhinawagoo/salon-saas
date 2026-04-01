import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendChatText, sendChatTemplate } from '@/lib/whatsapp-chat'

export const dynamic = 'force-dynamic'

// POST /api/admin/whatsapp/conversations/[id]/send
// Body: { type: 'text', message: string }
//     | { type: 'template', templateName: string, params: string[], lang?: string }
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: params.id },
      select: { mobile: true, customerName: true, userId: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const body = await request.json()
    const { type = 'text' } = body as { type: string }

    let result: { ok: boolean; messageId: string; error?: string }

    if (type === 'template') {
      const { templateName, params: tmplParams = [], lang } = body as {
        templateName: string
        params?: string[]
        lang?: string
      }

      if (!templateName) {
        return NextResponse.json({ error: 'templateName required' }, { status: 400 })
      }

      result = await sendChatTemplate(
        conversation.mobile,
        templateName,
        tmplParams,
        'agent',
        {
          customerName: conversation.customerName ?? undefined,
          userId: conversation.userId ?? undefined,
          languageCode: lang,
        }
      )
    } else {
      const { message } = body as { message: string }
      if (!message?.trim()) {
        return NextResponse.json({ error: 'message required' }, { status: 400 })
      }

      result = await sendChatText(conversation.mobile, message.trim(), 'agent', {
        customerName: conversation.customerName ?? undefined,
        userId: conversation.userId ?? undefined,
      })
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error, messageId: result.messageId }, { status: 502 })
    }

    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err) {
    console.error('[WhatsApp agent send]', err)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}

// PATCH /api/admin/whatsapp/conversations/[id]/send — toggle resolved state
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { isResolved } = body as { isResolved: boolean }

    const conv = await prisma.whatsAppConversation.update({
      where: { id: params.id },
      data: { isResolved: !!isResolved },
      select: { id: true, isResolved: true },
    })

    return NextResponse.json(conv)
  } catch (err) {
    console.error('[WhatsApp resolve]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
