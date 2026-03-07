import { NextRequest } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'
import { getOrCreateCustomer, createCheckoutSession } from '@/app/lib/stripe'
import { parseBody, success, error } from '@/app/lib/api'
import { stripeCheckoutSchema } from '@/app/lib/schemas'

export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, stripeCheckoutSchema)
  if (!parsed.ok) return parsed.response

  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, stripe_customer_id')
      .eq('id', auth.user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      customerId = await getOrCreateCustomer(
        auth.user.id,
        auth.user.email,
        profile?.full_name || undefined
      )

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', auth.user.id)
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const session = await createCheckoutSession({
      customerId,
      priceId: parsed.data.priceId,
      successUrl: `${origin}/prototype/settings?billing=success`,
      cancelUrl: `${origin}/prototype/settings?billing=cancelled`,
      trialDays: 14,
    })

    await logActivity(
      auth.user.id,
      'stripe_checkout_created',
      'Started subscription checkout',
      'success',
      { priceId: parsed.data.priceId }
    )

    return success({ url: session.url })
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err)
    return error(
      err instanceof Error ? err.message : 'Failed to create checkout',
      500
    )
  }
}
