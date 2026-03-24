import { NextResponse } from 'next/server'
import { sendWhatsAppText } from '@/app/lib/messaging/whatsapp'
import { withAuth } from '@/app/lib/auth'
import { parseBody, success, error } from '@/app/lib/api'
import { whatsappSendSchema } from '@/app/lib/schemas'
import { checkUsageLimits, limitExceededPayload } from '@/app/lib/billing/usage'
import { rateLimitMessaging } from '@/app/lib/rate-limit'

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  // Rate limit: 30 sends per minute per user
  const rl = rateLimitMessaging(auth.user.id)
  if (rl.limited) {
    return NextResponse.json({ ok: false, error: 'Sending too fast. Please wait.' }, { status: 429 })
  }

  // Check messaging quota
  const usage = await checkUsageLimits(auth.user.id, 'whatsapp')
  if (!usage.allowed) {
    return NextResponse.json(limitExceededPayload(usage, 'whatsapp'), { status: 402 })
  }

  const parsed = await parseBody(request, whatsappSendSchema)
  if (!parsed.ok) return parsed.response

  const { to, body } = parsed.data

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log('[DEMO MODE] WhatsApp message simulated')
    return success({ demo: true, to, body })
  }

  const result = await sendWhatsAppText({ to, body })

  if (!result.ok) {
    return error(result.error || 'WhatsApp send failed.', result.status || 500)
  }

  return success({ message: 'WhatsApp message sent.', ...result.data })
}
