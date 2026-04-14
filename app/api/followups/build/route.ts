import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { buildSchedule, resolveProfile } from '@/app/lib/cadence/scheduler'

export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Fetch user's automation profile (followup_* columns)
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('followup_automation_mode, followup_approval_window_hours, followup_default_template, followup_template_by_lead_type, followup_quiet_hours_start, followup_quiet_hours_end, followup_tcpa_enabled, followup_skip_weekends, followup_max_touches')
    .eq('id', auth.user.id)
    .single()

  const profile = resolveProfile(profileRow)

  // Get leads with sms_text (phone OR email, with lead_type for template resolution)
  const { data: allLeads, error: leadsError } = await supabase
    .from('leads')
    .select('id, owner_name, property_address, phone, email, sms_text, lead_type')
    .eq('user_id', auth.user.id)
    .not('sms_text', 'is', null)

  if (leadsError) {
    return NextResponse.json(
      { ok: false, error: leadsError.message },
      { status: 500 }
    )
  }

  // Skip leads that have neither phone nor email
  const leads = (allLeads || []).filter(l => l.phone || l.email)

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'Run "Generate Messages" first. No leads with messages found.',
      data: null,
    }, { status: 400 })
  }

  // Dedup check: only skip leads that have ACTIVE pending/sending follow-ups
  // (don't skip leads with cancelled/failed/sent follow-ups — they may need a fresh sequence)
  const leadIds = leads.map(l => l.id)
  const { data: existingFollowUps } = await supabase
    .from('follow_ups')
    .select('lead_id')
    .in('lead_id', leadIds)
    .in('status', ['pending', 'sending'])

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
      // Build the full schedule using the new cadence scheduler
      const rows = await buildSchedule({
        userId: auth.user.id,
        lead: {
          id: lead.id,
          owner_name: lead.owner_name,
          property_address: lead.property_address,
          phone: lead.phone,
          email: lead.email,
          lead_type: lead.lead_type as Parameters<typeof buildSchedule>[0]['lead']['lead_type'],
        },
        firstSms: lead.sms_text || '',
        profile,
        contactEmail,
      })

      if (rows.length === 0) {
        // Manual mode or no rows generated — count as processed but skip insert
        processed++
        continue
      }

      const { error: insertError } = await supabase
        .from('follow_ups')
        .insert(rows)

      if (insertError) {
        errors.push(`Lead ${lead.id}: ${insertError.message}`)
      } else {
        processed++
        followUpsCreated += rows.length
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
