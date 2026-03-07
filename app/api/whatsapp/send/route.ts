import { sendWhatsAppTemplate } from '@/app/lib/whatsapp'
import { withAuth } from '@/app/lib/auth'
import { parseBody, success, error } from '@/app/lib/api'
import { whatsappSendSchema } from '@/app/lib/schemas'

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, whatsappSendSchema)
  if (!parsed.ok) return parsed.response

  const { to, templateName, languageCode, bodyParams } = parsed.data

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log('[DEMO MODE] WhatsApp message simulated')
    return success({ demo: true, to, templateName, languageCode, bodyParams })
  }

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    bodyParams,
  })

  if (!result.ok) {
    return error(result.error || 'WhatsApp send failed.', result.status || 500)
  }

  return success({ message: 'WhatsApp message sent.', ...result.data })
}
