import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { generateFollowUpsForLead, buildFollowUpSchedule } from '@/app/lib/ai/followup-generator'

export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get leads with sms_text but no follow-ups scheduled
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, owner_name, property_address, phone, sms_text')
    .not('sms_text', 'is', null)
    .not('phone', 'is', null)

  if (leadsError) {
    return NextResponse.json(
      { ok: false, error: leadsError.message },
      { status: 500 }
    )
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'Run "Generate Messages" first. No leads with messages found.',
      data: null,
    }, { status: 400 })
  }

  // Check which leads already have follow-ups
  const leadIds = leads.map(l => l.id)
  const { data: existingFollowUps } = await supabase
    .from('follow_ups')
    .select('lead_id')
    .in('lead_id', leadIds)
    .eq('status', 'pending')

  const leadsWithFollowUps = new Set((existingFollowUps || []).map(f => f.lead_id))
  const leadsNeedingFollowUps = leads.filter(l => !leadsWithFollowUps.has(l.id))

  if (leadsNeedingFollowUps.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'All leads already have follow-ups scheduled.',
      data: { processed: 0, skipped: leads.length },
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: 'Demo mode: OPENAI_API_KEY not set. Follow-ups were not generated.',
      data: { leadCount: leadsNeedingFollowUps.length },
    })
  }

  let processed = 0
  let followUpsCreated = 0
  const errors: string[] = []
  const contactEmail = process.env.CONTACT_EMAIL

  for (const lead of leadsNeedingFollowUps) {
    try {
      // Generate follow-up messages
      const followUpMessages = await generateFollowUpsForLead(
        {
          owner_name: lead.owner_name || undefined,
          property_address: lead.property_address || undefined,
        },
        lead.sms_text || '',
        { contactEmail }
      )

      // Build schedule
      const schedule = buildFollowUpSchedule(
        lead.id,
        {
          owner_name: lead.owner_name || undefined,
          property_address: lead.property_address || undefined,
          phone: lead.phone || undefined,
        },
        followUpMessages
      )

      // Insert follow-ups into database
      const followUpsToInsert = schedule.map(s => ({
        user_id: auth.user.id,
        lead_id: s.leadId,
        message_text: s.messageText,
        scheduled_at: s.scheduledAt.toISOString(),
        status: 'pending',
      }))

      const { error: insertError } = await supabase
        .from('follow_ups')
        .insert(followUpsToInsert)

      if (insertError) {
        errors.push(`Lead ${lead.id}: ${insertError.message}`)
      } else {
        processed++
        followUpsCreated += schedule.length
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Lead ${lead.id}: ${message}`)
    }
  }

  // Log activity
  await logActivity(
    auth.user.id,
    'followup',
    `Built follow-up schedule: ${followUpsCreated} messages for ${processed} leads`,
    processed > 0 ? 'success' : 'failed',
    {
      leadsProcessed: processed,
      followUpsCreated,
      errors: errors.length,
    }
  )

  return NextResponse.json({
    ok: true,
    message: `Built follow-ups for ${processed} leads (${followUpsCreated} messages).`,
    data: {
      processed,
      followUpsCreated,
      skipped: leads.length - leadsNeedingFollowUps.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
