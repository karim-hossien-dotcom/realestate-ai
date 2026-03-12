import { createClient, createServiceClient } from '@/app/lib/supabase/server'

export type GatedFeature =
  | 'follow_up_automation'
  | 'crm_integration'
  | 'ai_auto_reply'
  | 'campaigns'
  | 'team_management'

type PlanSlug = 'starter' | 'pro' | 'agency'

const PLAN_TIERS: Record<PlanSlug, number> = {
  starter: 0,
  pro: 1,
  agency: 2,
}

const FEATURE_MIN_PLAN: Record<GatedFeature, PlanSlug> = {
  follow_up_automation: 'pro',
  crm_integration: 'pro',
  ai_auto_reply: 'pro',
  campaigns: 'pro',
  team_management: 'agency',
}

const FEATURE_LABELS: Record<GatedFeature, string> = {
  follow_up_automation: 'Follow-up Automation',
  crm_integration: 'CRM Integration',
  ai_auto_reply: 'AI Auto-Replies',
  campaigns: 'Campaign Bulk Sending',
  team_management: 'Team Management',
}

const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type FeatureAccessResult =
  | { allowed: true; planSlug: PlanSlug }
  | {
      allowed: false
      planSlug: PlanSlug | null
      requiredPlan: PlanSlug
      featureLabel: string
      message: string
    }

/**
 * Check if a user has access to a gated feature based on their plan tier.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: GatedFeature,
  client?: SupabaseClient,
): Promise<FeatureAccessResult> {
  if (userId === ADMIN_USER_ID) {
    return { allowed: true, planSlug: 'agency' }
  }

  const planSlug = await getUserPlanSlug(userId, client)
  const requiredPlan = FEATURE_MIN_PLAN[feature]

  if (!planSlug) {
    return {
      allowed: false,
      planSlug: null,
      requiredPlan,
      featureLabel: FEATURE_LABELS[feature],
      message: `${FEATURE_LABELS[feature]} requires the ${capitalize(requiredPlan)} plan. Subscribe to get started.`,
    }
  }

  const userTier = PLAN_TIERS[planSlug as PlanSlug] ?? -1
  const requiredTier = PLAN_TIERS[requiredPlan]

  if (userTier >= requiredTier) {
    return { allowed: true, planSlug: planSlug as PlanSlug }
  }

  return {
    allowed: false,
    planSlug: planSlug as PlanSlug,
    requiredPlan,
    featureLabel: FEATURE_LABELS[feature],
    message: `${FEATURE_LABELS[feature]} is available on the ${capitalize(requiredPlan)} plan and above. You're on ${capitalize(planSlug)}. Upgrade to unlock this feature.`,
  }
}

/**
 * Get the plan slug for a user. Returns null if no active subscription.
 */
export async function getUserPlanSlug(
  userId: string,
  client?: SupabaseClient,
): Promise<string | null> {
  const supabase = client ?? await createClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plans(slug)')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (sub?.plans as { slug: string } | null)?.slug ?? null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Build a 402 JSON payload for feature access denied.
 */
export function featureBlockedPayload(
  result: Extract<FeatureAccessResult, { allowed: false }>,
) {
  return {
    ok: false,
    error: 'feature_blocked',
    message: result.message,
    feature: result.featureLabel,
    currentPlan: result.planSlug,
    requiredPlan: result.requiredPlan,
  }
}
