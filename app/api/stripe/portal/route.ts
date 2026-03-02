import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'
import { createPortalSession } from '@/app/lib/stripe'

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for managing subscription
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', auth.user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'No subscription found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const session = await createPortalSession(
      profile.stripe_customer_id,
      `${origin}/prototype/settings`
    )

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err) {
    console.error('[Stripe Portal] Error:', err)
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : 'Failed to create portal session',
      },
      { status: 500 }
    )
  }
}
