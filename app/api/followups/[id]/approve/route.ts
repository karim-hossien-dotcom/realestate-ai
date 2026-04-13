import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/followups/[id]/approve
 * Approve a pending follow-up. Sets approval_status='approved', approved_at, approved_by.
 * Verifies the follow-up belongs to the authenticated user.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const supabase = createServiceClient()

    // Verify ownership and current status before updating
    const { data: followup, error: fetchError } = await supabase
      .from('follow_ups')
      .select('id, approval_status')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single()

    if (fetchError || !followup) {
      return NextResponse.json(
        { ok: false, error: 'Follow-up not found or access denied' },
        { status: 404 }
      )
    }

    if (followup.approval_status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: `Cannot approve — approval status is already '${followup.approval_status}'` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('follow_ups')
      .update({
        approval_status: 'approved',
        approved_at: now,
        approved_by: auth.user.id,
      })
      .eq('id', id)
      .eq('user_id', auth.user.id)

    if (error) {
      await logActivity(
        auth.user.id,
        'followup.approve',
        `Failed to approve follow-up ${id}: ${error.message}`,
        'failed',
        { followupId: id, error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'followup.approve',
      `Approved follow-up ${id}`,
      'success',
      { followupId: id }
    )

    return NextResponse.json({ ok: true, approved: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
