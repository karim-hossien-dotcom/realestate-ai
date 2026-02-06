import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { sendEmail, generateFollowUpEmail } from '@/app/lib/email'
import { sendWhatsAppTemplate } from '@/app/lib/whatsapp'

const MAX_RETRIES = 3
const BATCH_SIZE = 10 // Process max 10 follow-ups per run

type FollowUp = {
  id: string
  user_id: string
  lead_id: string
  message_text: string
  scheduled_at: string
  status: string
  channel: string | null
  retry_count: number
  follow_up_number: number | null
}

type Lead = {
  id: string
  owner_name: string | null
  email: string | null
  phone: string | null
  property_address: string | null
}

type Profile = {
  id: string
  full_name: string | null
  email: string
  phone: string | null
  company: string | null
}

/**
 * POST /api/cron/send-followups
 * Cron endpoint to send pending follow-ups
 * Should be called every 5 minutes by external cron service
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron] Unauthorized cron request')
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron] Starting follow-up send job...')

  const supabase = createServiceClient()
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  }

  try {
    // Get pending follow-ups that are due
    const now = new Date().toISOString()
    const { data: followUps, error: fetchError } = await supabase
      .from('follow_ups')
      .select('id, user_id, lead_id, message_text, scheduled_at, status, channel, retry_count, follow_up_number')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .lt('retry_count', MAX_RETRIES)
      .order('scheduled_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('[Cron] Error fetching follow-ups:', fetchError)
      return NextResponse.json({ ok: false, error: 'Failed to fetch follow-ups' }, { status: 500 })
    }

    if (!followUps || followUps.length === 0) {
      console.log('[Cron] No pending follow-ups to send')
      return NextResponse.json({ ok: true, message: 'No pending follow-ups', results })
    }

    console.log(`[Cron] Found ${followUps.length} follow-ups to process`)

    // Process each follow-up
    for (const followUp of followUps as FollowUp[]) {
      results.processed++

      try {
        // Get lead info
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, owner_name, email, phone, property_address')
          .eq('id', followUp.lead_id)
          .single()

        if (leadError || !lead) {
          console.error(`[Cron] Lead not found for follow-up ${followUp.id}`)
          await markFollowUpFailed(supabase, followUp.id, followUp.retry_count, 'Lead not found')
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
          await markFollowUpFailed(supabase, followUp.id, followUp.retry_count, 'Profile not found')
          results.failed++
          continue
        }

        // Check DNC list
        const { data: dncCheck } = await supabase
          .rpc('check_dnc', { p_user_id: followUp.user_id, p_phone: lead.phone || '' })

        if (dncCheck) {
          console.log(`[Cron] Lead ${lead.id} is on DNC list, skipping`)
          await supabase
            .from('follow_ups')
            .update({ status: 'cancelled', error_message: 'Lead is on DNC list' })
            .eq('id', followUp.id)
          results.skipped++
          continue
        }

        // Determine channel - default to 'both' if not specified
        const channel = followUp.channel || 'both'
        let emailSent = false
        let whatsappSent = false
        const errors: string[] = []

        // Send Email
        if ((channel === 'both' || channel === 'email') && lead.email) {
          const emailResult = await sendFollowUpEmail(lead, profile, followUp)
          if (emailResult.ok) {
            emailSent = true
            await supabase
              .from('follow_ups')
              .update({ email_sent_at: new Date().toISOString() })
              .eq('id', followUp.id)
          } else {
            errors.push(`Email: ${emailResult.error}`)
          }
        } else if ((channel === 'both' || channel === 'email') && !lead.email) {
          errors.push('Email: No email address for lead')
        }

        // Send WhatsApp
        if ((channel === 'both' || channel === 'whatsapp') && lead.phone) {
          const waResult = await sendFollowUpWhatsApp(lead, profile, followUp)
          if (waResult.ok) {
            whatsappSent = true
            await supabase
              .from('follow_ups')
              .update({ whatsapp_sent_at: new Date().toISOString() })
              .eq('id', followUp.id)
          } else {
            errors.push(`WhatsApp: ${waResult.error}`)
          }
        } else if ((channel === 'both' || channel === 'whatsapp') && !lead.phone) {
          errors.push('WhatsApp: No phone number for lead')
        }

        // Determine final status
        let newStatus: string
        if (emailSent || whatsappSent) {
          if (errors.length === 0) {
            newStatus = 'sent'
            results.sent++
          } else {
            newStatus = 'partial'
            results.sent++
          }
        } else {
          newStatus = 'failed'
          results.failed++
        }

        // Update follow-up status
        await supabase
          .from('follow_ups')
          .update({
            status: newStatus,
            sent_at: emailSent || whatsappSent ? new Date().toISOString() : null,
            error_message: errors.length > 0 ? errors.join('; ') : null,
            retry_count: newStatus === 'failed' ? followUp.retry_count + 1 : followUp.retry_count,
          })
          .eq('id', followUp.id)

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: followUp.user_id,
          event_type: 'follow_up_sent',
          description: `Follow-up ${newStatus}: ${emailSent ? 'Email' : ''}${emailSent && whatsappSent ? ' + ' : ''}${whatsappSent ? 'WhatsApp' : ''}`,
          status: newStatus === 'sent' ? 'success' : newStatus === 'partial' ? 'success' : 'failed',
          metadata: {
            follow_up_id: followUp.id,
            lead_id: lead.id,
            email_sent: emailSent,
            whatsapp_sent: whatsappSent,
            errors,
          },
        })

        // Log message records
        if (emailSent) {
          await supabase.from('messages').insert({
            user_id: followUp.user_id,
            lead_id: lead.id,
            direction: 'outbound',
            channel: 'email',
            to_number: lead.email,
            body: followUp.message_text,
            status: 'sent',
          })
        }

        if (whatsappSent) {
          await supabase.from('messages').insert({
            user_id: followUp.user_id,
            lead_id: lead.id,
            direction: 'outbound',
            channel: 'whatsapp',
            to_number: lead.phone,
            body: followUp.message_text,
            status: 'sent',
          })
        }

      } catch (err) {
        console.error(`[Cron] Error processing follow-up ${followUp.id}:`, err)
        await markFollowUpFailed(
          supabase,
          followUp.id,
          followUp.retry_count,
          err instanceof Error ? err.message : 'Unknown error'
        )
        results.failed++
        results.errors.push(`Follow-up ${followUp.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
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

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request)
}

async function markFollowUpFailed(
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  currentRetryCount: number,
  errorMessage: string
) {
  const newRetryCount = currentRetryCount + 1
  const status = newRetryCount >= MAX_RETRIES ? 'failed' : 'pending'

  await supabase
    .from('follow_ups')
    .update({
      status,
      retry_count: newRetryCount,
      error_message: errorMessage,
    })
    .eq('id', id)
}

async function sendFollowUpEmail(
  lead: Lead,
  profile: Profile,
  followUp: FollowUp
): Promise<{ ok: boolean; error?: string }> {
  if (!lead.email) {
    return { ok: false, error: 'No email address' }
  }

  const agentName = profile.full_name || 'Your Real Estate Agent'
  const agentPhone = profile.phone || ''
  const agentEmail = profile.email
  const recipientName = lead.owner_name?.split(' ')[0] || 'there'
  const propertyAddress = lead.property_address || 'your property'

  const { subject, html, text } = generateFollowUpEmail({
    recipientName,
    propertyAddress,
    agentName,
    agentPhone,
    agentEmail,
    followUpNumber: followUp.follow_up_number || 1,
  })

  const result = await sendEmail({
    to: lead.email,
    subject,
    html,
    text,
    fromName: agentName,
    replyTo: agentEmail,
  })

  return result
}

async function sendFollowUpWhatsApp(
  lead: Lead,
  profile: Profile,
  followUp: FollowUp
): Promise<{ ok: boolean; error?: string }> {
  if (!lead.phone) {
    return { ok: false, error: 'No phone number' }
  }

  const agentName = profile.full_name || 'Your Real Estate Agent'
  const recipientName = lead.owner_name?.split(' ')[0] || 'there'

  // Use the message_text from the follow-up, or build template params
  const result = await sendWhatsAppTemplate({
    to: lead.phone,
    bodyParams: [recipientName, agentName],
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  return { ok: true }
}
