import { createClient, createServiceClient } from '@/app/lib/supabase/server'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''
const BYPASS_USER_IDS = [
  ADMIN_USER_ID,
  process.env.BYPASS_USER_ID_1 || '',  // Nadine — first client, full free access
].filter(Boolean)

type ResourceType = 'leads' | 'sms' | 'email' | 'whatsapp'

interface UsageLimitResult {
  allowed: boolean
  current: number
  limit: number
  remaining: number
  planName: string
  planSlug: string
  /** Next plan slug the user should upgrade to, or null if on highest tier */
  upgradeSlug: string | null
  /** True when the user is over their included quota (overage charges apply) */
  isOverage: boolean
  /** ISO string for the start of the current billing period */
  periodStart: string
}

interface NoSubscriptionResult {
  allowed: false
  error: 'no_subscription'
  message: string
}

type CheckResult = UsageLimitResult | NoSubscriptionResult

const UPGRADE_PATH: Record<string, string | null> = {
  starter: 'pro',
  pro: 'agency',
  agency: null,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/**
 * Check whether a user has capacity for a given resource type.
 *
 * - 'leads' checks total lead count against plan's included_leads
 * - 'sms' / 'email' / 'whatsapp' counts ALL outbound messages (shared pool) this billing period
 *
 * Returns an object with { allowed, current, limit, remaining, planName, upgradeSlug }.
 * If the user has no active subscription, returns { allowed: false, error: 'no_subscription' }.
 *
 * @param client Optional supabase client (pass createServiceClient() for cron routes without cookies)
 */
export async function checkUsageLimits(
  userId: string,
  resource: ResourceType,
  client?: SupabaseClient,
): Promise<CheckResult> {
  // Admin/VIP bypass — unlimited access without subscription
  if (BYPASS_USER_IDS.includes(userId)) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: Infinity,
      planName: 'Admin',
      planSlug: 'agency',
      upgradeSlug: null,
      isOverage: false,
      periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
    }
  }

  const supabase = client ?? await createClient()

  // 1. Get active subscription + plan info
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub || !sub.plans) {
    return {
      allowed: false,
      error: 'no_subscription',
      message: 'You need an active subscription to use this feature. Please subscribe to a plan.',
    }
  }

  const plan = sub.plans as {
    name: string
    slug: string
    included_sms: number
    included_leads: number
  }

  // 2. Determine limit for this resource
  let limit: number

  if (resource === 'leads') {
    limit = plan.included_leads // -1 means unlimited
  } else {
    // All messaging channels share ONE pool (included_sms)
    limit = plan.included_sms
  }

  const periodStart = sub.current_period_start
    ? new Date(sub.current_period_start).toISOString()
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // Unlimited (-1) — always allow
  if (limit === -1) {
    return {
      allowed: true,
      current: 0,
      limit: -1,
      remaining: Infinity,
      planName: plan.name,
      planSlug: plan.slug,
      upgradeSlug: UPGRADE_PATH[plan.slug] ?? null,
      isOverage: false,
      periodStart,
    }
  }

  // 3. Count current usage
  let current: number

  if (resource === 'leads') {
    const { count } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    current = count || 0
  } else {
    // Messages: count ALL outbound messages (shared pool across channels) for the billing period
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .gte('created_at', periodStart)

    current = count || 0
  }

  const remaining = Math.max(limit - current, 0)
  const isOverage = current >= limit

  return {
    allowed: true, // Always allow for subscribed users — overages are billed
    current,
    limit,
    remaining,
    planName: plan.name,
    planSlug: plan.slug,
    upgradeSlug: UPGRADE_PATH[plan.slug] ?? null,
    isOverage,
    periodStart,
  }
}

/**
 * Lightweight quota check for service/cron contexts (no cookies).
 * Returns { allowed, remaining, isOverage, periodStart }.
 */
export async function checkMessageQuota(
  userId: string,
  channel: 'sms' | 'email' | 'whatsapp',
): Promise<{ allowed: boolean; remaining: number; isOverage: boolean; periodStart: string }> {
  const supabase = createServiceClient()
  const result = await checkUsageLimits(userId, channel, supabase)
  if (!isUsageLimitResult(result)) {
    // No subscription = not allowed
    return { allowed: false, remaining: 0, isOverage: false, periodStart: '' }
  }
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    isOverage: result.isOverage,
    periodStart: result.periodStart,
  }
}

/**
 * Type guard: returns true if the result has usage details (not a no_subscription error).
 */
export function isUsageLimitResult(result: CheckResult): result is UsageLimitResult {
  return !('error' in result)
}

/**
 * Build a user-friendly 402 error payload for limit exceeded responses.
 */
export function limitExceededPayload(result: CheckResult, resource: ResourceType) {
  if (!isUsageLimitResult(result)) {
    return { ok: false, error: 'no_subscription', message: result.message }
  }
  const resourceLabels: Record<ResourceType, string> = {
    leads: 'leads',
    sms: 'SMS messages',
    email: 'email messages',
    whatsapp: 'WhatsApp messages',
  }

  const label = resourceLabels[resource]
  const upgradeMsg = result.upgradeSlug
    ? `Upgrade to the ${result.upgradeSlug.charAt(0).toUpperCase() + result.upgradeSlug.slice(1)} plan for higher limits.`
    : 'You are on the highest plan. Contact support for custom limits.'

  return {
    ok: false,
    error: 'limit_exceeded',
    message: `You've reached your ${result.planName} plan limit of ${result.limit} ${label}. ${upgradeMsg}`,
    usage: {
      current: result.current,
      limit: result.limit,
      remaining: result.remaining,
    },
    plan: result.planName,
    upgradeSlug: result.upgradeSlug,
  }
}
