import { NextRequest, NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'
import { getOrCreateCustomer, createCheckoutSession } from '@/app/lib/stripe'

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for subscription
 * Body: { priceId: string, annual?: boolean }
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  let body: { priceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!body.priceId) {
    return NextResponse.json(
      { ok: false, error: 'priceId is required' },
      { status: 400 }
    )
  }

  try {
    // Get user profile for name
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id')
      .eq('id', auth.user.id)
      .single()

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      customerId = await getOrCreateCustomer(
        auth.user.id,
        auth.user.email,
        profile?.full_name || undefined
      )

      // Save stripe_customer_id to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', auth.user.id)
    }

    // Determine URLs
    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const session = await createCheckoutSession({
      customerId,
      priceId: body.priceId,
      successUrl: `${origin}/prototype/settings?billing=success`,
      cancelUrl: `${origin}/prototype/settings?billing=cancelled`,
      trialDays: 14,
    })

    await logActivity(
      auth.user.id,
      'stripe_checkout_created',
      'Started subscription checkout',
      'success',
      { priceId: body.priceId }
    )

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err)
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : 'Failed to create checkout',
      },
      { status: 500 }
    )
  }
}
