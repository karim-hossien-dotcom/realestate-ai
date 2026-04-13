import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

const MAX_BATCH = 100

const bulkApproveSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, 'At least one ID required')
    .max(MAX_BATCH, `Maximum ${MAX_BATCH} follow-ups per batch`),
})

/**
 * POST /api/followups/bulk-approve
 * Approve multiple pending follow-ups in a single request.
 * Body: { ids: string[] } — max 100 UUIDs.
 * Only affects follow-ups owned by the authenticated user (enforced via .eq('user_id')).
 */
export async function POST(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = bulkApproveSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Validation failed' },
        { status: 400 }
      )
    }

    const { ids } = parsed.data
    const now = new Date().toISOString()
    const supabase = createServiceClient()

    const { data: updated, error } = await supabase
      .from('follow_ups')
      .update({
        approval_status: 'approved',
        approved_at: now,
        approved_by: auth.user.id,
      })
      .in('id', ids)
      .eq('user_id', auth.user.id)
      .eq('approval_status', 'pending')
      .select('id')

    if (error) {
      await logActivity(
        auth.user.id,
        'followup.bulk_approve',
        `Failed to bulk-approve follow-ups: ${error.message}`,
        'failed',
        { ids, error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const approvedCount = updated?.length ?? 0

    await logActivity(
      auth.user.id,
      'followup.bulk_approve',
      `Bulk-approved ${approvedCount} follow-up${approvedCount !== 1 ? 's' : ''} (${ids.length} requested)`,
      'success',
      { requested: ids.length, approved: approvedCount }
    )

    return NextResponse.json({ ok: true, approved: approvedCount })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
