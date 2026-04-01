import { NextResponse } from 'next/server'
import { sendChatText, sendChatTemplate } from '@/lib/whatsapp-chat'

export const dynamic = 'force-dynamic'

// POST /api/admin/crm/send
// All messages are saved to DB (whatsapp_chat) via whatsapp-chat helpers.
// Body: {
//   mode: 'template' | 'text'
//   mobiles: string[]             // selected customer mobiles
//   customMobiles?: string        // newline-separated additional numbers
//   // template mode:
//   templateName?: string
//   templateParams?: string[]     // body params {{1}}, {{2}} ...
//   templateLanguage?: string     // default 'en'
//   // text mode:
//   message?: string              // supports {name} placeholder
//   names?: Record<string, string> // mobile -> name mapping
// }

const RATE_LIMIT_MS = 500

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseCustomMobiles(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().replace(/\D/g, ''))
    .filter((s) => s.length >= 10)
    .map((s) => (s.length === 10 ? `91${s}` : s))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      mode,
      mobiles = [],
      customMobiles = '',
      templateName,
      templateParams = [],
      templateLanguage = 'en',
      message = '',
      names = {},
    } = body as {
      mode: 'template' | 'text'
      mobiles: string[]
      customMobiles?: string
      templateName?: string
      templateParams?: string[]
      templateLanguage?: string
      message?: string
      names?: Record<string, string>
    }

    if (!mode) {
      return NextResponse.json({ error: 'mode is required' }, { status: 400 })
    }
    if (mode === 'template' && !templateName) {
      return NextResponse.json({ error: 'templateName is required for template mode' }, { status: 400 })
    }
    if (mode === 'text' && !message.trim()) {
      return NextResponse.json({ error: 'message is required for text mode' }, { status: 400 })
    }

    const extra = customMobiles ? parseCustomMobiles(customMobiles) : []
    const allMobiles = Array.from(new Set([...mobiles, ...extra])).filter(Boolean)

    if (allMobiles.length === 0) {
      return NextResponse.json({ error: 'No valid mobile numbers provided' }, { status: 400 })
    }

    const results: { mobile: string; ok: boolean; error?: string }[] = []

    for (let i = 0; i < allMobiles.length; i++) {
      const mobile = allMobiles[i]
      const customerName = names[mobile] || names[mobile.replace(/^91/, '')] || undefined

      let result: { ok: boolean; error?: string }

      if (mode === 'template') {
        result = await sendChatTemplate(mobile, templateName!, templateParams, 'system', {
          customerName,
          languageCode: templateLanguage,
          refType: 'crm',
        })
      } else {
        const name = customerName || 'Valued Customer'
        const text = message.replace(/\{name\}/gi, name)
        result = await sendChatText(mobile, text, 'system', {
          customerName,
          refType: 'crm',
        })
      }

      results.push({ mobile, ...result })

      if (i < allMobiles.length - 1) {
        await sleep(RATE_LIMIT_MS)
      }
    }

    const successCount = results.filter((r) => r.ok).length
    return NextResponse.json({
      sent: successCount,
      failed: results.length - successCount,
      total: results.length,
      results,
    })
  } catch (err) {
    console.error('[CRM send]', err)
    return NextResponse.json({ error: 'Failed to send messages' }, { status: 500 })
  }
}
