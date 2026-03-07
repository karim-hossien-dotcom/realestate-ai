import Stripe from 'stripe'

// Server-side Stripe client
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }
  return new Stripe(key)
}

// Plan definitions — these match what you create in the Stripe Dashboard
export const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 9900, // cents
    priceLabel: '$99/mo',
    annualPrice: 99000, // cents ($990/yr = ~$82.50/mo)
    annualLabel: '$990/yr',
    includedSms: 750,
    includedLeads: 250,
    maxUsers: 1,
    features: [
      'Up to 250 leads',
      '750 SMS messages/month',
      'WhatsApp + Email + SMS',
      'AI message generation',
      'Lead scoring',
      'Basic analytics',
      '1 user',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 24900,
    priceLabel: '$249/mo',
    annualPrice: 249000, // $2,490/yr = ~$207.50/mo
    annualLabel: '$2,490/yr',
    includedSms: 3000,
    includedLeads: 1000,
    maxUsers: 5,
    features: [
      'Up to 1,000 leads',
      '3,000 SMS messages/month',
      'Everything in Starter',
      'Follow-up automation',
      'CRM integration (FUB)',
      'Advanced analytics',
      'Priority support',
      'Up to 5 users',
    ],
    popular: true,
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: 49900,
    priceLabel: '$499/mo',
    annualPrice: 499000, // $4,990/yr = ~$415.83/mo
    annualLabel: '$4,990/yr',
    includedSms: 15000,
    includedLeads: -1, // unlimited
    maxUsers: 15,
    features: [
      'Unlimited leads',
      '15,000 SMS messages/month',
      'Everything in Pro',
      'Team management',
      'White-label reports',
      'Dedicated support',
      'Custom integrations',
      'Up to 15 users',
    ],
  },
] as const

export type PlanSlug = (typeof PLANS)[number]['slug']

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const stripe = getStripe()

  // Check if user already has a stripe_customer_id in profiles
  // (caller should pass it if available to avoid this lookup)
  const existing = await stripe.customers.list({ email, limit: 1 })
  if (existing.data.length > 0) {
    return existing.data[0].id
  }

  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { supabase_user_id: userId },
  })

  return customer.id
}

/**
 * Create a Stripe Checkout session for a subscription
 */
export async function createCheckoutSession(params: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  trialDays?: number
}) {
  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    subscription_data: params.trialDays
      ? { trial_period_days: params.trialDays }
      : undefined,
    allow_promotion_codes: true,
  })

  return session
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
) {
  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}
