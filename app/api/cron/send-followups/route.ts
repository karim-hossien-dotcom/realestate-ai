import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { sendEmail, generateFollowUpEmail } from '@/app/lib/email'
import { sendWhatsAppText } from '@/app/lib/whatsapp'
import { sendSms } from '@/app/lib/sms'
import { isOnNationalDnc } from '@/app/lib/dnc-registry'
import { checkMessageQuota } from '@/app/lib/usage'

const BATCH_SIZE = 10

type FollowUp = {
  id: string
  user_id: string
  lead_id: string
  message_text: string
  scheduled_at: string
  status: string
  sent_at: string | null
  created_at: string
}

type Lead = {
  id: string
  owner_name: string | null
  email: string | null
  phone: string | null
  property_address: string | null
  contact_preference: string | null
}

type Profile = {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  company: string | null
}

/**
 * GET|POST /api/cron/send-followups
 * Cron endpoint to send pending follow-ups.
 * Called every 5 minutes by Render cron.
 *
 * CRITICAL: Immediately marks follow-ups as 'sending' before processing
 * to prevent duplicate sends across overlapping cron invocations.
 */
async function handler(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const { searchParams } = new URL(request.url)
  const querySecret = searchParams.get('secret')

  const authorized = cronSecret && (
    authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret
  )

  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

  try {
    const now = new Date().toISOString()

    // Fetch pending follow-ups that are due
    const { data: followUps, error: fetchError } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('[Cron] Error fetching follow-ups:', fetchError)
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
    }

    if (!followUps || followUps.length === 0) {
      return NextResponse.json({ ok: true, message: 'No pending follow-ups', results })
    }

    console.log(`[Cron] Found ${followUps.length} follow-ups to process`)

    // CRITICAL: Immediately mark all as 'sending' to prevent duplicate processing
    const ids = followUps.map(f => f.id)
    await supabase
      .from('follow_ups')
      .update({ status: 'sending' })
      .in('id', ids)

    for (const followUp of followUps as FollowUp[]) {
      results.processed++

      try {
        // Get lead info
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, owner_name, email, phone, property_address, contact_preference')
          .eq('id', followUp.lead_id)
          .single()

        if (leadError || !lead) {
          console.error(`[Cron] Lead not found for follow-up ${followUp.id}`)
          await supabase.from('follow_ups').update({ status: 'failed' }).eq('id', followUp.id)
          results.failed++
          continue
        }

        // Get user/agent profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, company')
          .eq('id', followUp.user_id)
          .single()

        if (profileError || !profile) {
          console.error(`[Cron] Profile not found for user ${followUp.user_id}`)
          await supabase.from('follow_ups').update({ status: 'failed' }).eq('id', followUp.id)
          results.failed++
          continue
        }

        // Check DNC list
        const { count: dncCount } = await supabase
          .from('dnc_list')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', followUp.user_id)
          .eq('phone', lead.phone || '')

        if (dncCount && dncCount > 0) {
          console.log(`[Cron] Lead ${lead.id} is on DNC list, skipping`)
          await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', followUp.id)
          results.skipped++
          continue
        }

        // Check message quota — skip if user has exhausted their plan
        const pref = lead.contact_preference || 'whatsapp'
        const quotaChannel = (pref === 'call' ? 'whatsapp' : pref) as 'sms' | 'email' | 'whatsapp'
        const quota = await checkMessageQuota(followUp.user_id, quotaChannel)
        if (!quota.allowed) {
          console.log(`[Cron] User ${followUp.user_id} exceeded message quota, rescheduling follow-up ${followUp.id}`)
          // Revert to pending so it can be retried next billing period
          await supabase.from('follow_ups').update({ status: 'pending' }).eq('id', followUp.id)
          await supabase.from('activity_logs').insert({
            user_id: followUp.user_id,
            event_type: 'follow_up_quota_exceeded',
            description: `Follow-up ${followUp.id} skipped — message quota exceeded. Upgrade plan for more capacity.`,
            status: 'failed',
            metadata: { follow_up_id: followUp.id, lead_id: lead.id },
          })
          results.skipped++
          continue
        }

        // Determine channel from lead's contact_preference
        const channel = lead.contact_preference || 'whatsapp'
        let messageSent = false
        const errors: string[] = []

        // Send via preferred channel
        if ((channel === 'whatsapp' || channel === 'call') && lead.phone) {
          const waResult = await sendFollowUpWhatsApp(lead, profile, followUp)
          if (waResult.ok) {
            messageSent = true
          } else {
            errors.push(`WhatsApp: ${waResult.error}`)
          }
        } else if (channel === 'sms' && lead.phone) {
          // Check National DNC Registry for SMS
          const onNationalDnc = await isOnNationalDnc(lead.phone)
          if (onNationalDnc) {
            await supabase.from('follow_ups').update({ status: 'cancelled' }).eq('id', followUp.id)
            results.skipped++
            continue
          }
          const smsResult = await sendFollowUpSms(lead, profile, followUp)
          if (smsResult.ok) {
            messageSent = true
          } else {
            errors.push(`SMS: ${smsResult.error}`)
          }
        } else if (channel === 'email' && lead.email) {
          const emailResult = await sendFollowUpEmail(lead, profile, followUp)
          if (emailResult.ok) {
            messageSent = true
          } else {
            errors.push(`Email: ${emailResult.error}`)
          }
        } else {
          // Fallback: try WhatsApp if phone exists, else email
          if (lead.phone) {
            const waResult = await sendFollowUpWhatsApp(lead, profile, followUp)
            if (waResult.ok) messageSent = true
            else errors.push(`WhatsApp: ${waResult.error}`)
          } else if (lead.email) {
            const emailResult = await sendFollowUpEmail(lead, profile, followUp)
            if (emailResult.ok) messageSent = true
            else errors.push(`Email: ${emailResult.error}`)
          } else {
            errors.push('No phone or email for lead')
          }
        }

        // Update follow-up status — only uses columns that actually exist
        const newStatus = messageSent ? 'sent' : 'failed'
        await supabase
          .from('follow_ups')
          .update({
            status: newStatus,
            sent_at: messageSent ? new Date().toISOString() : null,
          })
          .eq('id', followUp.id)

        if (messageSent) {
          results.sent++
        } else {
          results.failed++
        }

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: followUp.user_id,
          event_type: 'follow_up_sent',
          description: `Follow-up ${newStatus} via ${channel}${errors.length > 0 ? ': ' + errors.join('; ') : ''}`,
          status: messageSent ? 'success' : 'failed',
          metadata: {
            follow_up_id: followUp.id,
            lead_id: lead.id,
            channel,
            errors,
          },
        })

        // Log message record
        if (messageSent) {
          const msgChannel = (channel === 'call' ? 'whatsapp' : channel) as string
          await supabase.from('messages').insert({
            user_id: followUp.user_id,
            lead_id: lead.id,
            direction: 'outbound',
            channel: msgChannel,
            to_number: channel === 'email' ? lead.email : lead.phone,
            body: followUp.message_text,
            status: 'sent',
          })
        }

      } catch (err) {
        console.error(`[Cron] Error processing follow-up ${followUp.id}:`, err)
        await supabase.from('follow_ups').update({ status: 'failed' }).eq('id', followUp.id)
        results.failed++
        results.errors.push(`${followUp.id}: ${err instanceof Error ? err.message : 'Unknown'}`)
      }
    }

    console.log('[Cron] Job completed:', results)
    return NextResponse.json({ ok: true, results })

  } catch (err) {
    console.error('[Cron] Job failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = handler
export const POST = handler

async function sendFollowUpEmail(
  lead: Lead,
  profile: Profile,
  followUp: FollowUp
): Promise<{ ok: boolean; error?: string }> {
  if (!lead.email) return { ok: false, error: 'No email address' }

  const agentName = profile.full_name || 'Your Real Estate Agent'
  const { subject, html, text } = generateFollowUpEmail({
    recipientName: lead.owner_name?.split(' ')[0] || 'there',
    propertyAddress: lead.property_address || 'your property',
    agentName,
    agentPhone: profile.phone || '',
    agentEmail: profile.email,
    followUpNumber: 1,
    userId: followUp.user_id,
  })

  return await sendEmail({
    to: lead.email,
    subject,
    html,
    text,
    fromName: agentName,
    replyTo: profile.email,
  })
}

async function sendFollowUpSms(
  lead: Lead,
  profile: Profile,
  followUp: FollowUp
): Promise<{ ok: boolean; error?: string }> {
  if (!lead.phone) return { ok: false, error: 'No phone number' }

  const agentName = profile.full_name || 'Your Real Estate Agent'
  const recipientName = lead.owner_name?.split(' ')[0] || 'there'
  const body = followUp.message_text || `Hi ${recipientName}, just following up about your property. Feel free to reach out! - ${agentName}`

  return await sendSms({ to: lead.phone, body })
}

async function sendFollowUpWhatsApp(
  lead: Lead,
  profile: Profile,
  followUp: FollowUp
): Promise<{ ok: boolean; error?: string }> {
  if (!lead.phone) return { ok: false, error: 'No phone number' }

  const agentName = profile.full_name || 'Your Real Estate Agent'
  const recipientName = lead.owner_name?.split(' ')[0] || 'there'
  const body = followUp.message_text || `Hi ${recipientName}, just following up about your property. Feel free to reach out! - ${agentName}\n\nReply STOP to opt out`

  const result = await sendWhatsAppText({ to: lead.phone, body })
  return { ok: result.ok, error: result.error }
}
