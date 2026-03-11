import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Get all non-dismissed NPS responses
  const { data: responses } = await supabase
    .from('nps_responses')
    .select('id, user_id, score, feedback, page_url, created_at')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  const entries = responses || []

  if (entries.length === 0) {
    return NextResponse.json({
      ok: true,
      npsScore: null,
      totalResponses: 0,
      distribution: { promoters: 0, passives: 0, detractors: 0 },
      recentFeedback: [],
    })
  }

  // Calculate NPS
  let promoters = 0
  let passives = 0
  let detractors = 0

  for (const r of entries) {
    if (r.score >= 9) promoters++
    else if (r.score >= 7) passives++
    else detractors++
  }

  const total = entries.length
  const npsScore = Math.round(((promoters - detractors) / total) * 100)

  // Recent feedback (with text)
  const recentFeedback = entries
    .filter(r => r.feedback)
    .slice(0, 20)
    .map(r => ({
      score: r.score,
      feedback: r.feedback,
      createdAt: r.created_at,
    }))

  return NextResponse.json({
    ok: true,
    npsScore,
    totalResponses: total,
    distribution: { promoters, passives, detractors },
    recentFeedback,
  })
}
