import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

/**
 * GET /api/admin/ai-improvements
 * List all AI improvement proposals (pending first, then recent).
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  try {
    const supabase = createServiceClient()

    const { data: improvements, error } = await supabase
      .from('ai_improvements')
      .select('*')
      .order('status', { ascending: true }) // pending first
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const pending = (improvements || []).filter(i => i.status === 'pending').length
    const accepted = (improvements || []).filter(i => i.status === 'accepted' || i.status === 'implemented').length
    const rejected = (improvements || []).filter(i => i.status === 'rejected').length

    return NextResponse.json({
      ok: true,
      improvements: improvements || [],
      summary: { total: (improvements || []).length, pending, accepted, rejected },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/ai-improvements
 * Accept or reject an improvement proposal.
 * Body: { id, action: 'accept' | 'reject', reason?: string }
 */
export async function PATCH(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, action, reason } = body as { id: string; action: string; reason?: string }

    if (!id || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'id and action (accept/reject) required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const update: Record<string, unknown> = {
      status: action === 'accept' ? 'accepted' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'karim',
    }

    if (action === 'reject' && reason) {
      update.rejection_reason = reason
    }

    const { error } = await supabase
      .from('ai_improvements')
      .update(update)
      .eq('id', id)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id, status: update.status })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
