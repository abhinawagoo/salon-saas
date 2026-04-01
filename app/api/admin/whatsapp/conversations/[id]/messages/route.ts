import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

// GET /api/admin/whatsapp/conversations/[id]/messages?cursor=<messageId>
// Returns PAGE_SIZE messages in chronological ASC order.
// Pass cursor=<oldest-currently-loaded-messageId> to load older messages.
//
// Also marks conversation as read (unreadCount → 0).
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor') // ID of oldest message currently shown

    let messages
    if (cursor) {
      // Find the cursor message to get its createdAt
      const cursorMsg = await prisma.whatsAppMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })

      if (!cursorMsg) {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
      }

      // Get PAGE_SIZE messages BEFORE the cursor (older)
      messages = await prisma.whatsAppMessage.findMany({
        where: {
          conversationId: params.id,
          createdAt: { lt: cursorMsg.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE,
        select: {
          id: true,
          waMessageId: true,
          direction: true,
          senderType: true,
          body: true,
          messageType: true,
          status: true,
          templateName: true,
          refType: true,
          refId: true,
          createdAt: true,
        },
      })
      // Reverse so oldest is first
      messages = messages.reverse()
    } else {
      // Initial load: last PAGE_SIZE messages
      messages = await prisma.whatsAppMessage.findMany({
        where: { conversationId: params.id },
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE,
        select: {
          id: true,
          waMessageId: true,
          direction: true,
          senderType: true,
          body: true,
          messageType: true,
          status: true,
          templateName: true,
          refType: true,
          refId: true,
          createdAt: true,
        },
      })
      messages = messages.reverse()

      // Mark conversation as read
      await prisma.whatsAppConversation.update({
        where: { id: params.id },
        data: { unreadCount: 0 },
      })
    }

    const hasMore = messages.length === PAGE_SIZE

    return NextResponse.json({ messages, hasMore })
  } catch (err) {
    console.error('[WhatsApp messages]', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
