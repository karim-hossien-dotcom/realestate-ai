import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe, PLANS } from '@/app/lib/stripe'
import { createServiceClient } from '@/app/lib/supabase/server'

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events
 * NOTE: This must NOT use withAuth() — Stripe calls this directly
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          await handleSubscriptionChange(supabase, subscription)

          // Save customer ID to profile if not already saved
          if (session.customer && session.customer_details?.email) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', session.customer_details.email)
              .limit(1)

            if (profiles?.[0]) {
              await supabase
                .from('profiles')
                .update({ stripe_customer_id: session.customer as string })
                .eq('id', profiles[0].id)
            }
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const invoiceSubId = (invoice as unknown as Record<string, unknown>).subscription as string | null
        if (invoiceSubId) {
          const subscription = await stripe.subscriptions.retrieve(invoiceSubId)
          await handleSubscriptionChange(supabase, subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const failedSubId = (invoice as unknown as Record<string, unknown>).subscription as string | null
        if (failedSubId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', failedSubId)
        }
        // Log the failure
        const failedCustomerId = (invoice as unknown as Record<string, unknown>).customer as string | null
        if (failedCustomerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', failedCustomerId)
            .single()

          if (profile) {
            await supabase.from('activity_logs').insert({
              user_id: profile.id,
              event_type: 'payment_failed',
              description: 'Subscription payment failed — please update your payment method',
              status: 'failed',
              metadata: { invoice_id: (invoice as unknown as Record<string, unknown>).id as string },
            })
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(supabase, subscription)
        break
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (profile) {
          await supabase.from('activity_logs').insert({
            user_id: profile.id,
            event_type: 'trial_ending',
            description: 'Your free trial ends in 3 days — add a payment method to continue',
            status: 'pending',
          })
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}

/**
 * Upsert subscription data from Stripe into our subscriptions table
 */
async function handleSubscriptionChange(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription
) {
  // Use raw access for fields that changed in Stripe API v2025+
  const raw = subscription as unknown as Record<string, unknown>
  const customerId = raw.customer as string

  // Find user by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error(
      `[Stripe Webhook] No profile found for customer ${customerId}`
    )
    return
  }

  // Get the price ID from the subscription to determine the plan
  const items = subscription.items?.data || []
  const priceId = items[0]?.price?.id
  const productId = items[0]?.price?.product as string

  // Find matching plan
  let planId: string | null = null
  if (priceId || productId) {
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .or(`stripe_price_id.eq.${priceId},stripe_product_id.eq.${productId}`)
      .limit(1)
      .single()

    if (plan) {
      planId = plan.id
    }
  }

  // Extract period timestamps (may be on subscription or items depending on API version)
  const periodStart = raw.current_period_start as number | undefined
  const periodEnd = raw.current_period_end as number | undefined
  const trialEnd = raw.trial_end as number | null | undefined
  const cancelAtPeriodEnd = raw.cancel_at_period_end as boolean | undefined

  // Upsert subscription
  await supabase.from('subscriptions').upsert(
    {
      user_id: profile.id,
      plan_id: planId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
      current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      trial_end: trialEnd
        ? new Date(trialEnd * 1000).toISOString()
        : null,
      cancel_at_period_end: cancelAtPeriodEnd ?? false,
    },
    { onConflict: 'stripe_subscription_id' }
  )

  // Log activity
  await supabase.from('activity_logs').insert({
    user_id: profile.id,
    event_type: 'subscription_changed',
    description: `Subscription ${subscription.status}`,
    status: 'success',
    metadata: {
      stripe_subscription_id: subscription.id,
      status: subscription.status,
    },
  })
}
