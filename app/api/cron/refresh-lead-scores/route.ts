import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { calculateLeadScore, type LeadScoreInput } from '@/app/lib/ai/lead-scorer'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * GET /api/cron/refresh-lead-scores
 * Recalculates lead scores for all active leads.
 * Applies time decay and updates score_category in the leads table.
 * Schedule: Daily at 2am.
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

    // Fetch all leads with activity in last 90 days (or any lead with a score)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, user_id, status, phone, email, last_contacted, score_category')
      .or(`last_contacted.gte.${ninetyDaysAgo},score_category.neq.Dead`)
      .limit(5000)

    if (leadsError) {
      console.error('Failed to fetch leads for scoring:', leadsError)
      return NextResponse.json({ ok: false, error: leadsError.message }, { status: 500 })
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, updated: 0, message: 'No leads to score' })
    }

    // Get message counts per lead in one query
    const leadIds = leads.map(l => l.id)
    const { data: messageCounts } = await supabase
      .from('messages')
      .select('lead_id, direction')
      .in('lead_id', leadIds)

    // Build message stats per lead
    const leadStats: Record<string, { sent: number; received: number; lastResponse: string | null }> = {}
    for (const msg of messageCounts || []) {
      if (!msg.lead_id) continue
      if (!leadStats[msg.lead_id]) {
        leadStats[msg.lead_id] = { sent: 0, received: 0, lastResponse: null }
      }
      if (msg.direction === 'outbound') {
        leadStats[msg.lead_id].sent++
      } else {
        leadStats[msg.lead_id].received++
      }
    }

    // Get last response date per lead (separate query for accuracy)
    const { data: lastResponses } = await supabase
      .from('messages')
      .select('lead_id, created_at')
      .in('lead_id', leadIds)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })

    const lastResponseMap: Record<string, string> = {}
    for (const msg of lastResponses || []) {
      if (msg.lead_id && !lastResponseMap[msg.lead_id]) {
        lastResponseMap[msg.lead_id] = msg.created_at
      }
    }

    // Score each lead and batch update
    let updated = 0
    const batchSize = 50
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize)
      const updates = batch.map(lead => {
        const stats = leadStats[lead.id] || { sent: 0, received: 0 }
        const input: LeadScoreInput = {
          status: lead.status,
          responseCount: stats.received,
          messagesSent: stats.sent,
          lastResponse: lastResponseMap[lead.id] || null,
          lastContacted: lead.last_contacted,
          hasPhone: !!lead.phone,
          hasEmail: !!lead.email,
        }
        const result = calculateLeadScore(input)
        return { id: lead.id, score_category: result.category, oldCategory: lead.score_category }
      })

      // Only update leads whose category actually changed
      const changed = updates.filter(u => u.score_category !== u.oldCategory)
      for (const update of changed) {
        await supabase
          .from('leads')
          .update({ score_category: update.score_category })
          .eq('id', update.id)
        updated++
      }
    }

    return NextResponse.json({
      ok: true,
      processed: leads.length,
      updated,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Lead score refresh error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
