import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must use vi.hoisted so env is set BEFORE ESM imports resolve
vi.hoisted(() => {
  process.env.ADMIN_USER_ID = 'test-admin-id'
})

// Mock Supabase
vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}))

// Mock Stripe SDK — must use a class/function constructor
vi.mock('stripe', () => {
  function MockStripe() {
    return {
      invoiceItems: { create: vi.fn() },
      customers: { list: vi.fn(), create: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
    }
  }
  return { default: MockStripe }
})

import { createClient, createServiceClient } from '@/app/lib/supabase/server'
import { checkUsageLimits, isUsageLimitResult, limitExceededPayload } from '@/app/lib/billing/usage'
import { checkFeatureAccess, getUserPlanSlug, featureBlockedPayload } from '@/app/lib/billing/feature-gate'
import { OVERAGE_RATES } from '@/app/lib/billing/overage'
import { PLANS, getStripe } from '@/app/lib/billing/stripe'

// Helper to create a chainable Supabase mock
function mockSupabaseChain(singleResult: { data: unknown; error?: unknown }, countResult?: { count: number }) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockImplementation((_sel?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        return { ...chain, eq: vi.fn().mockReturnValue({ count: countResult?.count ?? 0 }) }
      }
      return chain
    }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(singleResult),
    insert: vi.fn().mockReturnValue({ error: null }),
    update: vi.fn().mockReturnThis(),
  }
  return chain
}

// ---------- Usage Limits ----------

describe('checkUsageLimits()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('bypasses for admin user', async () => {
    const result = await checkUsageLimits('test-admin-id', 'sms')
    expect(result.allowed).toBe(true)
    if (isUsageLimitResult(result)) {
      expect(result.limit).toBe(-1)
      expect(result.remaining).toBe(Infinity)
      expect(result.planSlug).toBe('agency')
      expect(result.isOverage).toBe(false)
    }
  })

  it('returns no_subscription when user has no subscription', async () => {
    const mock = mockSupabaseChain({ data: null })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-no-sub', 'sms')
    expect(result.allowed).toBe(false)
    expect('error' in result && result.error).toBe('no_subscription')
  })

  it('allows subscribed user under limit', async () => {
    const sub = {
      plans: { name: 'Starter', slug: 'starter', included_sms: 750, included_leads: 250 },
      current_period_start: '2026-03-01T00:00:00Z',
    }
    // Mock for subscription lookup
    const mock = mockSupabaseChain({ data: sub })

    // Override select for count query (messages)
    let selectCallCount = 0
    mock.select = vi.fn().mockImplementation((_sel?: string, opts?: { count?: string }) => {
      selectCallCount++
      if (opts?.count === 'exact') {
        // Return a chain that ends with count
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({ count: 100 }),
            }),
          }),
        }
      }
      return mock
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-123', 'sms')
    expect(result.allowed).toBe(true)
    if (isUsageLimitResult(result)) {
      expect(result.current).toBe(100)
      expect(result.limit).toBe(750)
      expect(result.remaining).toBe(650)
      expect(result.isOverage).toBe(false)
      expect(result.planName).toBe('Starter')
    }
  })

  it('allows subscribed user over limit with isOverage=true', async () => {
    const sub = {
      plans: { name: 'Starter', slug: 'starter', included_sms: 750, included_leads: 250 },
      current_period_start: '2026-03-01T00:00:00Z',
    }
    const mock = mockSupabaseChain({ data: sub })

    let selectCallCount = 0
    mock.select = vi.fn().mockImplementation((_sel?: string, opts?: { count?: string }) => {
      selectCallCount++
      if (opts?.count === 'exact') {
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({ count: 800 }),
            }),
          }),
        }
      }
      return mock
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-123', 'sms')
    expect(result.allowed).toBe(true) // Never blocks subscribed users
    if (isUsageLimitResult(result)) {
      expect(result.isOverage).toBe(true)
      expect(result.remaining).toBe(0)
    }
  })

  it('returns unlimited for plan with -1 limit', async () => {
    const sub = {
      plans: { name: 'Agency', slug: 'agency', included_sms: 15000, included_leads: -1 },
      current_period_start: '2026-03-01T00:00:00Z',
    }
    const mock = mockSupabaseChain({ data: sub })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-123', 'leads')
    expect(result.allowed).toBe(true)
    if (isUsageLimitResult(result)) {
      expect(result.limit).toBe(-1)
      expect(result.remaining).toBe(Infinity)
      expect(result.isOverage).toBe(false)
    }
  })

  it('returns correct upgradeSlug for starter', async () => {
    const sub = {
      plans: { name: 'Starter', slug: 'starter', included_sms: 750, included_leads: 250 },
      current_period_start: '2026-03-01T00:00:00Z',
    }
    const mock = mockSupabaseChain({ data: sub })

    mock.select = vi.fn().mockImplementation((_sel?: string, opts?: { count?: string }) => {
      if (opts?.count === 'exact') {
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({ count: 0 }),
            }),
          }),
        }
      }
      return mock
    })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-123', 'sms')
    if (isUsageLimitResult(result)) {
      expect(result.upgradeSlug).toBe('pro')
    }
  })

  it('returns null upgradeSlug for agency', async () => {
    const sub = {
      plans: { name: 'Agency', slug: 'agency', included_sms: 15000, included_leads: -1 },
      current_period_start: '2026-03-01T00:00:00Z',
    }
    const mock = mockSupabaseChain({ data: sub })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkUsageLimits('user-123', 'leads')
    if (isUsageLimitResult(result)) {
      expect(result.upgradeSlug).toBeNull()
    }
  })
})

describe('isUsageLimitResult()', () => {
  it('returns true for usage limit result', () => {
    const result = {
      allowed: true,
      current: 10,
      limit: 100,
      remaining: 90,
      planName: 'Starter',
      planSlug: 'starter',
      upgradeSlug: 'pro',
      isOverage: false,
      periodStart: '2026-03-01',
    }
    expect(isUsageLimitResult(result)).toBe(true)
  })

  it('returns false for no_subscription result', () => {
    const result = {
      allowed: false as const,
      error: 'no_subscription' as const,
      message: 'No subscription',
    }
    expect(isUsageLimitResult(result)).toBe(false)
  })
})

describe('limitExceededPayload()', () => {
  it('returns no_subscription payload', () => {
    const result = {
      allowed: false as const,
      error: 'no_subscription' as const,
      message: 'You need a subscription',
    }
    const payload = limitExceededPayload(result, 'sms')
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe('no_subscription')
  })

  it('returns limit_exceeded with upgrade message for starter', () => {
    const result = {
      allowed: true,
      current: 800,
      limit: 750,
      remaining: 0,
      planName: 'Starter',
      planSlug: 'starter',
      upgradeSlug: 'pro',
      isOverage: true,
      periodStart: '2026-03-01',
    }
    const payload = limitExceededPayload(result, 'sms')
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe('limit_exceeded')
    expect(payload.message).toContain('750')
    expect(payload.message).toContain('SMS messages')
    expect(payload.message).toContain('Pro plan')
  })

  it('returns contact support message for agency', () => {
    const result = {
      allowed: true,
      current: 16000,
      limit: 15000,
      remaining: 0,
      planName: 'Agency',
      planSlug: 'agency',
      upgradeSlug: null,
      isOverage: true,
      periodStart: '2026-03-01',
    }
    const payload = limitExceededPayload(result, 'whatsapp')
    expect(payload.message).toContain('Contact support')
  })

  it('uses correct resource label for leads', () => {
    const result = {
      allowed: true,
      current: 260,
      limit: 250,
      remaining: 0,
      planName: 'Starter',
      planSlug: 'starter',
      upgradeSlug: 'pro',
      isOverage: true,
      periodStart: '2026-03-01',
    }
    const payload = limitExceededPayload(result, 'leads')
    expect(payload.message).toContain('leads')
  })
})

// ---------- Feature Gating ----------

describe('checkFeatureAccess()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('bypasses for admin user', async () => {
    const result = await checkFeatureAccess('test-admin-id', 'campaigns')
    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.planSlug).toBe('agency')
    }
  })

  it('blocks user with no subscription', async () => {
    const mock = mockSupabaseChain({ data: null })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkFeatureAccess('user-no-sub', 'campaigns')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.planSlug).toBeNull()
      expect(result.requiredPlan).toBe('pro')
      expect(result.message).toContain('Subscribe')
    }
  })

  it('blocks starter user from pro features', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'starter' } } })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkFeatureAccess('user-starter', 'follow_up_automation')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.planSlug).toBe('starter')
      expect(result.requiredPlan).toBe('pro')
      expect(result.message).toContain('Upgrade')
    }
  })

  it('allows pro user to access pro features', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'pro' } } })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkFeatureAccess('user-pro', 'campaigns')
    expect(result.allowed).toBe(true)
  })

  it('blocks pro user from agency features', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'pro' } } })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await checkFeatureAccess('user-pro', 'team_management')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.requiredPlan).toBe('agency')
    }
  })

  it('allows agency user to access all features', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'agency' } } })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    for (const feature of ['follow_up_automation', 'crm_integration', 'ai_auto_reply', 'campaigns', 'team_management'] as const) {
      const result = await checkFeatureAccess('user-agency', feature)
      expect(result.allowed).toBe(true)
    }
  })

  it('accepts custom supabase client', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'pro' } } })
    const result = await checkFeatureAccess('user-pro', 'campaigns', mock)
    expect(result.allowed).toBe(true)
    expect(mock.from).toHaveBeenCalledWith('subscriptions')
  })
})

describe('getUserPlanSlug()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns plan slug for subscribed user', async () => {
    const mock = mockSupabaseChain({ data: { plans: { slug: 'pro' } } })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const slug = await getUserPlanSlug('user-pro')
    expect(slug).toBe('pro')
  })

  it('returns null for unsubscribed user', async () => {
    const mock = mockSupabaseChain({ data: null })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const slug = await getUserPlanSlug('user-none')
    expect(slug).toBeNull()
  })
})

describe('featureBlockedPayload()', () => {
  it('returns correct payload shape', () => {
    const result = {
      allowed: false as const,
      planSlug: 'starter' as const,
      requiredPlan: 'pro' as const,
      featureLabel: 'Campaign Bulk Sending',
      message: 'Campaign Bulk Sending is available on the Pro plan.',
    }
    const payload = featureBlockedPayload(result)
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe('feature_blocked')
    expect(payload.feature).toBe('Campaign Bulk Sending')
    expect(payload.currentPlan).toBe('starter')
    expect(payload.requiredPlan).toBe('pro')
  })
})

// ---------- Overage Rates ----------

describe('OVERAGE_RATES', () => {
  it('has correct SMS rate (5 cents)', () => {
    expect(OVERAGE_RATES.sms.rate).toBe(5)
    expect(OVERAGE_RATES.sms.currency).toBe('usd')
  })

  it('has correct email rate (2 cents)', () => {
    expect(OVERAGE_RATES.email.rate).toBe(2)
  })

  it('has correct WhatsApp rate (8 cents)', () => {
    expect(OVERAGE_RATES.whatsapp.rate).toBe(8)
  })

  it('has correct leads rate (15 cents)', () => {
    expect(OVERAGE_RATES.leads.rate).toBe(15)
  })

  it('has labels for all channels', () => {
    expect(OVERAGE_RATES.sms.label).toBeTruthy()
    expect(OVERAGE_RATES.email.label).toBeTruthy()
    expect(OVERAGE_RATES.whatsapp.label).toBeTruthy()
    expect(OVERAGE_RATES.leads.label).toBeTruthy()
  })
})

// ---------- Stripe Plan Definitions ----------

describe('PLANS', () => {
  it('has 3 plans', () => {
    expect(PLANS).toHaveLength(3)
  })

  it('starter plan has correct pricing and limits', () => {
    const starter = PLANS.find(p => p.slug === 'starter')!
    expect(starter.price).toBe(9900)
    expect(starter.includedSms).toBe(750)
    expect(starter.includedLeads).toBe(250)
    expect(starter.maxUsers).toBe(1)
  })

  it('pro plan has correct pricing and limits', () => {
    const pro = PLANS.find(p => p.slug === 'pro')!
    expect(pro.price).toBe(24900)
    expect(pro.includedSms).toBe(3000)
    expect(pro.includedLeads).toBe(1000)
    expect(pro.maxUsers).toBe(5)
  })

  it('agency plan has correct pricing and limits', () => {
    const agency = PLANS.find(p => p.slug === 'agency')!
    expect(agency.price).toBe(49900)
    expect(agency.includedSms).toBe(15000)
    expect(agency.includedLeads).toBe(-1) // unlimited
    expect(agency.maxUsers).toBe(15)
  })
})

describe('getStripe()', () => {
  const origKey = process.env.STRIPE_SECRET_KEY

  afterEach(() => {
    if (origKey) {
      process.env.STRIPE_SECRET_KEY = origKey
    } else {
      delete process.env.STRIPE_SECRET_KEY
    }
  })

  it('throws when STRIPE_SECRET_KEY is not set', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(() => getStripe()).toThrow('STRIPE_SECRET_KEY is not configured')
  })

  it('returns Stripe instance when key is set', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    const stripe = getStripe()
    expect(stripe).toBeDefined()
  })
})
