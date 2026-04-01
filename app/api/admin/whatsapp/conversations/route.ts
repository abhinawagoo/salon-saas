import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/whatsapp/conversations?q=&resolved=false
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const resolvedParam = searchParams.get('resolved')
    const resolved = resolvedParam === 'true' ? true : resolvedParam === 'false' ? false : undefined

    const conversations = await prisma.whatsAppConversation.findMany({
      where: {
        ...(resolved !== undefined ? { isResolved: resolved } : {}),
        ...(q
          ? {
              OR: [
                { customerName: { contains: q, mode: 'insensitive' } },
                { mobile: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [
        { lastMessageAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        mobile: true,
        customerName: true,
        lastMessageAt: true,
        lastMessagePreview: true,
        unreadCount: true,
        isResolved: true,
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[WhatsApp conversations]', err)
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }
}
