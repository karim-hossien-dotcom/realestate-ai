import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

// GET — check if user should see NPS prompt
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()

  // Check account age (must be >= 7 days old)
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', auth.user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ ok: true, showNps: false })
  }

  const accountAgeDays = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (accountAgeDays < 7) {
    return NextResponse.json({ ok: true, showNps: false, reason: 'account_too_new' })
  }

  // Check if user responded in the last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentResponse } = await supabase
    .from('nps_responses')
    .select('id, created_at')
    .eq('user_id', auth.user.id)
    .gte('created_at', ninetyDaysAgo)
    .is('dismissed_at', null)
    .limit(1)

  if (recentResponse && recentResponse.length > 0) {
    return NextResponse.json({ ok: true, showNps: false, reason: 'recently_responded' })
  }

  // Check if user dismissed in the last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentDismiss } = await supabase
    .from('nps_responses')
    .select('id')
    .eq('user_id', auth.user.id)
    .not('dismissed_at', 'is', null)
    .gte('dismissed_at', fourteenDaysAgo)
    .limit(1)

  if (recentDismiss && recentDismiss.length > 0) {
    return NextResponse.json({ ok: true, showNps: false, reason: 'recently_dismissed' })
  }

  return NextResponse.json({ ok: true, showNps: true })
}

// POST — submit NPS score or dismiss
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const { score, feedback, pageUrl, dismiss } = body

  const supabase = await createClient()

  if (dismiss) {
    // Record dismissal
    await supabase.from('nps_responses').insert({
      user_id: auth.user.id,
      score: 0,
      feedback: null,
      page_url: pageUrl || null,
      dismissed_at: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, dismissed: true })
  }

  if (score === undefined || score === null || score < 0 || score > 10) {
    return NextResponse.json({ ok: false, error: 'Score must be 0-10' }, { status: 400 })
  }

  const { error } = await supabase.from('nps_responses').insert({
    user_id: auth.user.id,
    score: Math.round(score),
    feedback: feedback || null,
    page_url: pageUrl || null,
  })

  if (error) {
    await logActivity(auth.user.id, 'nps.submit', `Failed to submit NPS: ${error.message}`, 'failed')
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await logActivity(auth.user.id, 'nps.submit', `Submitted NPS score: ${score}`, 'success')
  return NextResponse.json({ ok: true, submitted: true })
}
