import { withAuth, logActivity } from '@/app/lib/auth'
import { sendEmail, generateOutreachEmail } from '@/app/lib/messaging/email'
import { createClient } from '@/app/lib/supabase/server'
import { parseBody, success, error } from '@/app/lib/api'
import { emailSendSchema } from '@/app/lib/schemas'
import { checkUsageLimits, limitExceededPayload, isUsageLimitResult } from '@/app/lib/billing/usage'
import { recordOverage } from '@/app/lib/billing/overage'

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, emailSendSchema)
  if (!parsed.ok) return parsed.response

  try {
    const { leadIds, customMessage } = parsed.data

    // Check email quota (shared messaging pool)
    const usage = await checkUsageLimits(auth.user.id, 'email')
    if (!usage.allowed) {
      const payload = limitExceededPayload(usage, 'email')
      return error(payload.message, 402)
    }

    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', auth.user.id)
      .single()

    const agentName = profile?.full_name || 'Real Estate Agent'
    const agentEmail = profile?.email || ''
    const agentPhone = profile?.phone || ''

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, owner_name, email, property_address, email_text')
      .in('id', leadIds)
      .eq('user_id', auth.user.id)

    if (leadsError) {
      return error('Failed to fetch leads', 500)
    }

    let leadsWithEmail = leads?.filter(l => l.email) || []

    if (leadsWithEmail.length === 0) {
      return error('No leads with email addresses found', 400)
    }

    // Cap batch to remaining quota
    if (isUsageLimitResult(usage) && usage.remaining !== Infinity && leadsWithEmail.length > usage.remaining) {
      leadsWithEmail = leadsWithEmail.slice(0, usage.remaining)
    }

    // Check DNC list
    const emails = leadsWithEmail.map(l => l.email!.toLowerCase())
    const { data: dncEmails } = await supabase
      .from('dnc_list')
      .select('phone')
      .eq('user_id', auth.user.id)
      .in('phone', emails)

    const dncSet = new Set(dncEmails?.map(d => d.phone.toLowerCase()) || [])

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: auth.user.id,
        name: `Email Campaign - ${new Date().toLocaleDateString()}`,
        status: 'sending',
        template_name: 'outreach_email',
        total_leads: leadsWithEmail.length,
      })
      .select()
      .single()

    if (campaignError) {
      return error('Failed to create campaign', 500)
    }

    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    for (const lead of leadsWithEmail) {
      if (dncSet.has(lead.email!.toLowerCase())) {
        results.skipped++
        continue
      }

      const emailContent = generateOutreachEmail({
        recipientName: lead.owner_name || 'Property Owner',
        propertyAddress: lead.property_address || 'your property',
        agentName,
        agentPhone,
        agentEmail,
        customMessage: lead.email_text || customMessage,
        userId: auth.user.id,
      })

      const result = await sendEmail({
        to: lead.email!,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: agentEmail,
        fromName: agentName,
      })

      await supabase.from('messages').insert({
        user_id: auth.user.id,
        lead_id: lead.id,
        campaign_id: campaign.id,
        direction: 'outbound',
        channel: 'email',
        to_number: lead.email,
        body: emailContent.text,
        status: result.ok ? 'sent' : 'failed',
        external_id: result.messageId,
        error_message: result.error,
      })

      await supabase.from('campaign_leads').insert({
        campaign_id: campaign.id,
        lead_id: lead.id,
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
      })

      if (result.ok) {
        results.sent++
        await supabase
          .from('leads')
          .update({ last_contacted: new Date().toISOString() })
          .eq('id', lead.id)
      } else {
        results.failed++
        results.errors.push(`${lead.email}: ${result.error}`)
      }
    }

    // Record overages for emails sent beyond plan quota
    if (isUsageLimitResult(usage) && usage.isOverage && results.sent > 0) {
      await recordOverage(auth.user.id, 'email', usage.periodStart, results.sent)
    }

    await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        sent_count: results.sent,
        failed_count: results.failed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    await logActivity(auth.user.id, 'email_campaign_sent', `Sent ${results.sent} emails`, 'success', {
      campaignId: campaign.id,
      ...results,
    })

    return success({ campaignId: campaign.id, results })
  } catch (err) {
    console.error('[Email Send] Error:', err)
    return error('Failed to send emails', 500)
  }
}
