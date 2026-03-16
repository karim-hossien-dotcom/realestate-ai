import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'
import { runWeeklyAudit } from '@/app/lib/ai-audit'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

// GET — fetch audit results by week
export async function GET(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week') // optional YYYY-MM-DD filter

  const supabase = createServiceClient()

  let query = supabase
    .from('ai_audits')
    .select('*')
    .order('overall_score', { ascending: true })
    .limit(100)

  if (week) {
    query = query.eq('audit_week', week)
  }

  const { data: audits } = await query

  const entries = audits || []
  const totalAudited = entries.length
  const avgScore = totalAudited > 0
    ? Math.round((entries.reduce((s, a) => s + Number(a.overall_score), 0) / totalAudited) * 10) / 10
    : 0

  // Score distribution
  const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 }
  for (const a of entries) {
    const score = Number(a.overall_score)
    if (score >= 4.5) distribution.excellent++
    else if (score >= 3.5) distribution.good++
    else if (score >= 2.5) distribution.fair++
    else distribution.poor++
  }

  // Available weeks
  const weekSet = new Set(entries.map(a => a.audit_week))
  const weeks = [...weekSet].sort().reverse()

  return NextResponse.json({
    ok: true,
    totalAudited,
    avgScore,
    distribution,
    weeks,
    audits: entries.map(a => ({
      id: a.id,
      leadId: a.conversation_lead_id,
      userId: a.conversation_user_id,
      messageCount: a.message_count,
      auditWeek: a.audit_week,
      scores: a.scores,
      overallScore: Number(a.overall_score),
      aiNotes: a.ai_notes,
      sampleMessages: a.sample_messages,
      createdAt: a.created_at,
    })),
  })
}

// POST — trigger manual audit run
export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  try {
    const result = await runWeeklyAudit()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
