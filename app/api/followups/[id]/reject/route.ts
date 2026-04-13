import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/followups/[id]/reject
 * Reject (cancel) a pending follow-up with an optional reason.
 * Sets status='cancelled', approval_status='rejected', rejected_reason.
 * Verifies the follow-up belongs to the authenticated user.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { id } = await params

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      // Body is optional — treat missing body as empty object
      raw = {}
    }

    const parsed = rejectSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Verify ownership and current status before updating
    const { data: followup, error: fetchError } = await supabase
      .from('follow_ups')
      .select('id, approval_status, status')
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
        { ok: false, error: `Cannot reject — approval status is already '${followup.approval_status}'` },
        { status: 400 }
      )
    }

    if (followup.status === 'sent' || followup.status === 'sending') {
      return NextResponse.json(
        { ok: false, error: `Cannot cancel — follow-up is already '${followup.status}'` },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'cancelled',
        approval_status: 'rejected',
        rejected_reason: parsed.data.reason ?? null,
      })
      .eq('id', id)
      .eq('user_id', auth.user.id)

    if (error) {
      await logActivity(
        auth.user.id,
        'followup.reject',
        `Failed to reject follow-up ${id}: ${error.message}`,
        'failed',
        { followupId: id, error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'followup.reject',
      `Rejected follow-up ${id}${parsed.data.reason ? `: ${parsed.data.reason}` : ''}`,
      'success',
      { followupId: id, reason: parsed.data.reason ?? null }
    )

    return NextResponse.json({ ok: true, rejected: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
