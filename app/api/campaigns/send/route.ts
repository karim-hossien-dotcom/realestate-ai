import { NextResponse } from 'next/server'
import { sendWhatsAppText } from '@/app/lib/whatsapp'
import { sendEmail, generateOutreachEmail } from '@/app/lib/email'
import { sendSms } from '@/app/lib/sms'
import { isOnNationalDnc } from '@/app/lib/dnc-registry'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { parseBody } from '@/app/lib/api'
import { campaignSendSchema } from '@/app/lib/schemas'
import { checkUsageLimits, limitExceededPayload, isUsageLimitResult } from '@/app/lib/usage'
import { checkFeatureAccess, featureBlockedPayload } from '@/app/lib/feature-gate'
import { recordOverage } from '@/app/lib/overage'

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

  const parsed = await parseBody(request, campaignSendSchema)
  if (!parsed.ok) return parsed.response

  // Gate: campaigns require Pro plan or above
  const featureAccess = await checkFeatureAccess(auth.user.id, 'campaigns')
  if (!featureAccess.allowed) {
    return NextResponse.json(featureBlockedPayload(featureAccess), { status: 402 })
  }

  const supabase = await createClient()

  const { leads, channel, campaignName: rawName } = parsed.data
  const channelLabel = channel === 'email' ? 'Email' : channel === 'sms' ? 'SMS' : 'WhatsApp'
  const campaignName = rawName || `${channelLabel} Campaign ${new Date().toISOString().slice(0, 10)}`

  // Check message quota against plan limits (shared pool across all channels)
  const msgResource = channel as 'sms' | 'email' | 'whatsapp'
  const usage = await checkUsageLimits(auth.user.id, msgResource)
  if (!usage.allowed) {
    return NextResponse.json(limitExceededPayload(usage, msgResource), { status: 402 })
  }

  // Cap batch to remaining quota — don't send more than the user has left
  let leadsToSend = leads
  let quotaTruncated = 0
  if (isUsageLimitResult(usage) && usage.remaining !== Infinity && leads.length > usage.remaining) {
    quotaTruncated = leads.length - usage.remaining
    leadsToSend = leads.slice(0, usage.remaining)
  }

  // Get user profile for agent info (used in emails)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone, company')
    .eq('id', auth.user.id)
    .single()

  const agentName = profile?.full_name || 'Real Estate Agent'
  const agentEmail = profile?.email || ''
  const agentPhone = profile?.phone || ''

  // Check channel configuration
  const hasWhatsAppConfig =
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  const hasEmailConfig = !!process.env.RESEND_API_KEY
  const hasSmsConfig = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)

  const isDemoMode = channel === 'email' ? !hasEmailConfig : channel === 'sms' ? !hasSmsConfig : !hasWhatsAppConfig

  // Create campaign record
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: auth.user.id,
      name: campaignName,
      status: 'sending',
      template_name: channel === 'email' ? 'outreach_email' : null,
      total_leads: leadsToSend.length,
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
  const RATE_LIMIT = 20 // messages per contact per day

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  for (let i = 0; i < leadsToSend.length; i++) {
    const lead = leadsToSend[i]
    // Pace sends to avoid rate limits (Resend: 2 req/sec)
    if (i > 0) await delay(600)

    // Get contact info based on channel
    const contact = channel === 'email'
      ? (lead.email || '').trim().toLowerCase()
      : String(lead.phone || '').trim().replace(/^\+/, '')  // works for both whatsapp and sms

    if (!contact) {
      results.push({ phone: '', ok: false, error: `Missing ${channel === 'email' ? 'email' : 'phone number'}` })
      failed++
      continue
    }

    // Check DNC list (works for both phone and email)
    const { data: isDnc } = await supabase.rpc('check_dnc', {
      p_user_id: auth.user.id,
      p_phone: contact,
    })

    if (isDnc) {
      results.push({ phone: contact, leadId: lead.id, ok: false, skipped: 'On DNC list' })
      skipped++
      continue
    }

    // Check National DNC Registry for SMS/voice campaigns
    if (channel === 'sms') {
      const onNationalDnc = await isOnNationalDnc(contact)
      if (onNationalDnc) {
        results.push({ phone: contact, leadId: lead.id, ok: false, skipped: 'On National DNC Registry' })
        skipped++
        continue
      }
    }

    // Check rate limit
    const { data: rateCheck } = await supabase.rpc('increment_rate_limit', {
      p_user_id: auth.user.id,
      p_phone: contact,
      p_limit: RATE_LIMIT,
    })

    if (rateCheck && !rateCheck[0]?.allowed) {
      results.push({
        phone: contact,
        leadId: lead.id,
        ok: false,
        skipped: `Rate limited (${rateCheck[0]?.current_count}/${RATE_LIMIT} today)`,
      })
      skipped++
      continue
    }

    // Demo mode - simulate sending
    if (isDemoMode) {
      console.log(`[DEMO MODE] ${channel} campaign message to ${contact}`)

      await supabase.from('messages').insert({
        user_id: auth.user.id,
        lead_id: lead.id || null,
        campaign_id: campaign.id,
        direction: 'outbound',
        channel,
        to_number: contact,
        body: channel === 'email' ? (lead.email_text || '[Email template]') : (lead.sms_text || '[Template message]'),
        status: 'sent',
      })

      if (lead.id) {
        await supabase.from('campaign_leads').insert({
          campaign_id: campaign.id,
          lead_id: lead.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      }

      results.push({ phone: contact, leadId: lead.id, ok: true, demo: true })
      sent++
      continue
    }

    // Real send based on channel
    let sendResult: { ok: boolean; messageId?: string; error?: string }

    if (channel === 'email') {
      // Send email
      const emailContent = generateOutreachEmail({
        recipientName: lead.owner_name || 'Property Owner',
        propertyAddress: lead.property_address || 'your property',
        agentName,
        agentPhone,
        agentEmail,
        customMessage: lead.email_text,
        userId: auth.user.id,
      })

      sendResult = await sendEmail({
        to: contact,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: agentEmail,
        fromName: agentName, // Shows as "Agent Name <outreach@domain.com>"
      })
    } else if (channel === 'sms') {
      // Send SMS
      const smsBody = lead.sms_text || `Hi ${lead.owner_name?.split(' ')[0] || 'there'}, I'm reaching out about your property. Reply for more info.`
      sendResult = await sendSms({ to: contact, body: smsBody })
    } else {
      // Send WhatsApp as plain text message
      const messageBody = lead.sms_text
        ? `Hello from ${profile?.company || 'our team'}:\n\n${lead.sms_text}\n\n- ${agentName}\n\nReply STOP to opt out`
        : `Hi ${lead.owner_name?.split(' ')[0] || 'there'}, I'm ${agentName} from ${profile?.company || 'our team'}. I noticed your property and wanted to reach out. Reply for more info or STOP to opt out.`

      const textResult = await sendWhatsAppText({ to: contact, body: messageBody })
      sendResult = { ok: textResult.ok, messageId: textResult.messageId, error: textResult.error }
    }

    // Record message in DB
    await supabase.from('messages').insert({
      user_id: auth.user.id,
      lead_id: lead.id || null,
      campaign_id: campaign.id,
      direction: 'outbound',
      channel,
      to_number: contact,
      body: channel === 'email' ? (lead.email_text || '[Email sent]') : (lead.sms_text || '[Template message]'),
      status: sendResult.ok ? 'sent' : 'failed',
      external_id: sendResult.messageId || null,
      error_message: sendResult.error || null,
    })

    if (lead.id) {
      await supabase.from('campaign_leads').insert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: sendResult.ok ? 'sent' : 'failed',
        sent_at: sendResult.ok ? new Date().toISOString() : null,
      })

      // Update lead last_contacted
      if (sendResult.ok) {
        await supabase
          .from('leads')
          .update({ last_contacted: new Date().toISOString() })
          .eq('id', lead.id)
      }
    }

    if (sendResult.ok) {
      results.push({ phone: contact, leadId: lead.id, ok: true })
      sent++
    } else {
      results.push({ phone: contact, leadId: lead.id, ok: false, error: sendResult.error })
      failed++
    }
  }

  // Record overages for messages sent beyond plan quota
  if (isUsageLimitResult(usage) && usage.isOverage && sent > 0) {
    await recordOverage(auth.user.id, msgResource, usage.periodStart, sent)
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
    `${channel}_campaign_send`,
    `${channelLabel} campaign "${campaignName}": ${sent} delivered, ${failed} failed, ${skipped} skipped`,
    sent > 0 ? 'success' : 'failed',
    {
      campaignId: campaign.id,
      campaignName,
      channel,
      total: leadsToSend.length,
      sent,
      failed,
      skipped,
      quotaTruncated,
      demo: isDemoMode,
    }
  )

  return NextResponse.json({
    ok: true,
    demo: isDemoMode,
    channel,
    campaignId: campaign.id,
    sent,
    failed,
    skipped,
    quotaTruncated,
    total: leadsToSend.length,
    results,
    ...(quotaTruncated > 0 && {
      warning: `${quotaTruncated} leads were not contacted — your plan's message quota was reached. Upgrade for more capacity.`,
    }),
  })
}
