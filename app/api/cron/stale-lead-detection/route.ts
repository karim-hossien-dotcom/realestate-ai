import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'

const CRON_SECRET = process.env.CRON_SECRET || ''
const STALE_DAYS = 14 // Leads with no activity for this many days are considered stale

/**
 * GET /api/cron/stale-lead-detection
 * Finds leads with no activity in 14+ days that still have a warm/hot score.
 * Creates follow-up tasks and flags them for re-engagement.
 * Schedule: Weekly on Monday.
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceClient()
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Find leads that haven't been contacted recently but aren't dead/DNC
    const { data: staleLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, user_id, owner_name, phone, email, status, score_category, last_contacted, property_address')
      .lt('last_contacted', staleCutoff)
      .not('status', 'in', '("not_interested","do_not_contact","dead","unsubscribed","closed")')
      .in('score_category', ['Hot', 'Warm'])
      .limit(500)

    if (leadsError) {
      console.error('Failed to fetch stale leads:', leadsError)
      return NextResponse.json({ ok: false, error: leadsError.message }, { status: 500 })
    }

    if (!staleLeads || staleLeads.length === 0) {
      return NextResponse.json({ ok: true, staleLeads: 0, followUpsCreated: 0, message: 'No stale leads found' })
    }

    // Group by user_id for follow-up creation
    const byUser: Record<string, typeof staleLeads> = {}
    for (const lead of staleLeads) {
      if (!byUser[lead.user_id]) byUser[lead.user_id] = []
      byUser[lead.user_id].push(lead)
    }

    let followUpsCreated = 0
    const today = new Date().toISOString().split('T')[0]

    for (const [userId, leads] of Object.entries(byUser)) {
      // Check which leads already have pending follow-ups to avoid duplicates
      const leadIds = leads.map(l => l.id)
      const { data: existingFollowUps } = await supabase
        .from('follow_ups')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('status', 'pending')

      const hasFollowUp = new Set((existingFollowUps || []).map(f => f.lead_id))

      // Create follow-ups for leads that don't have one
      const newFollowUps = leads
        .filter(l => !hasFollowUp.has(l.id))
        .map(lead => ({
          user_id: userId,
          lead_id: lead.id,
          channel: lead.phone ? 'whatsapp' : 'email',
          message: `Hi ${lead.owner_name || 'there'}, just checking in — are you still thinking about ${lead.property_address || 'your property'}? Happy to help whenever you're ready.`,
          status: 'pending',
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          source: 'stale_lead_detection',
        }))

      if (newFollowUps.length > 0) {
        const { error: insertError } = await supabase
          .from('follow_ups')
          .insert(newFollowUps)

        if (insertError) {
          console.error(`Failed to create follow-ups for user ${userId}:`, insertError)
        } else {
          followUpsCreated += newFollowUps.length
        }
      }

      // Create a project_task summary for hot stale leads (admin visibility)
      const hotStale = leads.filter(l => l.score_category === 'Hot' && !hasFollowUp.has(l.id))
      if (hotStale.length > 0) {
        const taskTitle = `${hotStale.length} hot lead${hotStale.length > 1 ? 's' : ''} going stale — re-engage`
        // Dedup by title + date
        const { data: existing } = await supabase
          .from('project_tasks')
          .select('id')
          .eq('title', taskTitle)
          .gte('created_at', `${today}T00:00:00`)
          .limit(1)

        if (!existing || existing.length === 0) {
          await supabase.from('project_tasks').insert({
            user_id: userId,
            department: 'marketing',
            priority: 'P0',
            status: 'pending',
            title: taskTitle,
            description: `Hot leads with no activity in ${STALE_DAYS}+ days: ${hotStale.map(l => l.owner_name || l.phone).join(', ')}. Auto follow-ups scheduled.`,
            is_blocker: false,
            is_automatable: true,
          })
        }
      }
    }

    return NextResponse.json({
      ok: true,
      staleLeads: staleLeads.length,
      followUpsCreated,
      byCategory: {
        hot: staleLeads.filter(l => l.score_category === 'Hot').length,
        warm: staleLeads.filter(l => l.score_category === 'Warm').length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Stale lead detection error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
