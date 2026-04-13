import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

/**
 * GET /api/followups/approval-queue
 * List all follow-ups pending approval for the current user.
 * Ordered by approval_deadline ASC so the most urgent items surface first.
 */
export async function GET() {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: followups, error } = await supabase
      .from('follow_ups')
      .select(
        'id, lead_id, message_text, scheduled_at, approval_deadline, cadence_template, lead_type'
      )
      .eq('user_id', auth.user.id)
      .eq('approval_status', 'pending')
      // Most urgent deadline first — agent needs to act before the window closes
      .order('approval_deadline', { ascending: true })

    if (error) {
      await logActivity(
        auth.user.id,
        'followup.approval_queue.get',
        `Failed to fetch approval queue: ${error.message}`,
        'failed',
        { error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!followups || followups.length === 0) {
      return NextResponse.json({ ok: true, followups: [] })
    }

    // Fetch lead details for display (name + phone)
    const leadIds = [...new Set(followups.map((f) => f.lead_id).filter(Boolean))]

    const { data: leads } = await supabase
      .from('leads')
      .select('id, owner_name, phone')
      .in('id', leadIds)
      .eq('user_id', auth.user.id)

    const leadMap = new Map((leads ?? []).map((l) => [l.id, l]))

    const queue = followups.map((f) => {
      const lead = leadMap.get(f.lead_id)
      return {
        id: f.id,
        lead_id: f.lead_id,
        lead_name: lead?.owner_name ?? 'Unknown',
        lead_phone: lead?.phone ?? null,
        message_text: f.message_text,
        scheduled_at: f.scheduled_at,
        approval_deadline: f.approval_deadline,
        cadence_template: f.cadence_template,
        lead_type: f.lead_type,
      }
    })

    return NextResponse.json({ ok: true, followups: queue })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
