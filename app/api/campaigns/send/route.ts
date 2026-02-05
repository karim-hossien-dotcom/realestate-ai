import { NextResponse } from 'next/server'
import { sendWhatsAppTemplate } from '@/app/lib/whatsapp'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

type LeadInput = {
  id?: string
  phone: string
  sms_text?: string
  owner_name?: string
}

type SendResult = {
  phone: string
  leadId?: string
  ok: boolean
  demo?: boolean
  error?: string
  skipped?: string
}

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  const leads: LeadInput[] = Array.isArray(body?.leads) ? body.leads : []
  const templateName = typeof body?.templateName === 'string' ? body.templateName : undefined
  const languageCode = typeof body?.languageCode === 'string' ? body.languageCode : undefined
  const campaignName = typeof body?.campaignName === 'string' ? body.campaignName : `Campaign ${new Date().toISOString().slice(0, 10)}`

  if (leads.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No leads provided.', sent: 0, failed: 0, results: [] },
      { status: 400 }
    )
  }

  const hasWhatsAppConfig =
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    (templateName || process.env.WHATSAPP_TEMPLATE_NAME)
  const isDemoMode = !hasWhatsAppConfig

  // Create campaign record
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: auth.user.id,
      name: campaignName,
      status: 'sending',
      template_name: templateName || process.env.WHATSAPP_TEMPLATE_NAME || null,
      total_leads: leads.length,
    })
    .select()
    .single()

  if (campaignError) {
    return NextResponse.json(
      { ok: false, error: `Failed to create campaign: ${campaignError.message}` },
      { status: 500 }
    )
  }

  const results: SendResult[] = []
  let sent = 0
  let failed = 0
  let skipped = 0
  const RATE_LIMIT = 5 // messages per phone per day

  for (const lead of leads) {
    const phone = String(lead.phone || '').trim().replace(/^\+/, '')
    if (!phone) {
      results.push({ phone: '', ok: false, error: 'Missing phone number' })
      failed++
      continue
    }

    // Check DNC list
    const { data: isDnc } = await supabase.rpc('check_dnc', {
      p_user_id: auth.user.id,
      p_phone: phone,
    })

    if (isDnc) {
      results.push({ phone, leadId: lead.id, ok: false, skipped: 'On DNC list' })
      skipped++
      continue
    }

    // Check rate limit
    const { data: rateCheck } = await supabase.rpc('increment_rate_limit', {
      p_user_id: auth.user.id,
      p_phone: phone,
      p_limit: RATE_LIMIT,
    })

    if (rateCheck && !rateCheck[0]?.allowed) {
      results.push({
        phone,
        leadId: lead.id,
        ok: false,
        skipped: `Rate limited (${rateCheck[0]?.current_count}/${RATE_LIMIT} today)`,
      })
      skipped++
      continue
    }

    // Demo mode - simulate sending
    if (isDemoMode) {
      console.log(`[DEMO MODE] WhatsApp campaign message to ${phone}`)

      // Record message in DB
      await supabase.from('messages').insert({
        user_id: auth.user.id,
        lead_id: lead.id || null,
        campaign_id: campaign.id,
        direction: 'outbound',
        channel: 'whatsapp',
        to_number: phone,
        body: lead.sms_text || '[Template message]',
        status: 'sent',
      })

      // Link lead to campaign
      if (lead.id) {
        await supabase.from('campaign_leads').insert({
          campaign_id: campaign.id,
          lead_id: lead.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      }

      results.push({ phone, leadId: lead.id, ok: true, demo: true })
      sent++
      continue
    }

    // Real WhatsApp send
    const effectiveTemplate = templateName || process.env.WHATSAPP_TEMPLATE_NAME || ''
    const bodyParams = effectiveTemplate !== 'hello_world' && lead.sms_text ? [lead.sms_text] : []

    const result = await sendWhatsAppTemplate({
      to: phone,
      templateName,
      languageCode,
      bodyParams,
    })

    // Record message in DB
    await supabase.from('messages').insert({
      user_id: auth.user.id,
      lead_id: lead.id || null,
      campaign_id: campaign.id,
      direction: 'outbound',
      channel: 'whatsapp',
      to_number: phone,
      body: lead.sms_text || '[Template message]',
      status: result.ok ? 'sent' : 'failed',
      external_id: result.messageId || null,
      error_message: result.error || null,
    })

    // Link lead to campaign
    if (lead.id) {
      await supabase.from('campaign_leads').insert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
      })
    }

    if (result.ok) {
      results.push({ phone, leadId: lead.id, ok: true })
      sent++
    } else {
      results.push({ phone, leadId: lead.id, ok: false, error: result.error })
      failed++
    }
  }

  // Update campaign stats
  await supabase
    .from('campaigns')
    .update({
      status: 'completed',
      sent_count: sent,
      failed_count: failed,
      completed_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  // Log activity
  await logActivity(
    auth.user.id,
    'campaign_send',
    `Campaign "${campaignName}" sent: ${sent} delivered, ${failed} failed, ${skipped} skipped`,
    sent > 0 ? 'success' : 'failed',
    {
      campaignId: campaign.id,
      campaignName,
      total: leads.length,
      sent,
      failed,
      skipped,
      demo: isDemoMode,
    }
  )

  return NextResponse.json({
    ok: true,
    demo: isDemoMode,
    campaignId: campaign.id,
    sent,
    failed,
    skipped,
    total: leads.length,
    results,
  })
}
