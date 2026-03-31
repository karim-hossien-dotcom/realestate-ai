import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.hoisted(() => {
  process.env.ADMIN_USER_ID = 'test-admin-id'
  process.env.BYPASS_USER_ID_1 = 'vip-user-id'
})

// ─── Mocks ───

let mockLeads: Array<Record<string, unknown>> = []
let mockMessages: Record<string, Array<Record<string, unknown>>> = {}

function createMockSupabase() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'leads') return { ...leadsChain }
      if (table === 'messages') return { ...messagesChain }
      return chain
    }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue({ data: null, error: null }),
  }

  const leadsChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ data: mockLeads, error: null }),
  }

  const messagesChain = {
    select: vi.fn().mockImplementation((_sel?: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.count === 'exact') {
        return {
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({ count: 0 }),
          // Support chained .eq() calls for filtering
          ...(() => {
            const countChain: Record<string, ReturnType<typeof vi.fn>> = {}
            countChain.eq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ count: 0 }) })
            return countChain
          })(),
        }
      }
      return messagesChain
    }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ data: [], error: null }),
  }

  return chain
}

let mockSupabase = createMockSupabase()

vi.mock('@/app/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
  createServiceClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/app/lib/auth', () => ({
  withAuth: vi.fn(async () => ({ ok: true, user: { id: 'vip-user-id' }, response: null })),
  logActivity: vi.fn(async () => {}),
}))

vi.mock('@/app/lib/billing/usage', () => ({
  checkUsageLimits: vi.fn(async () => ({
    allowed: true, current: 0, limit: -1, remaining: Infinity,
    planName: 'Admin', planSlug: 'agency', upgradeSlug: null,
    isOverage: false, periodStart: new Date().toISOString(),
  })),
  limitExceededPayload: vi.fn(),
  isUsageLimitResult: vi.fn(() => true),
}))

vi.mock('@/app/lib/billing/overage', () => ({
  recordOverage: vi.fn(async () => {}),
}))

vi.mock('@/app/lib/messaging/whatsapp', () => ({
  sendWhatsAppText: vi.fn(async () => ({ ok: true, messageId: 'wa-1' })),
}))

vi.mock('@/app/lib/messaging/sms', () => ({
  sendSms: vi.fn(async () => ({ ok: true, messageId: 'sms-1' })),
}))

vi.mock('@/app/lib/messaging/email', () => ({
  sendEmail: vi.fn(async () => ({ ok: true, messageId: 'email-1' })),
}))

// ─── Schema validation tests (the bugs that actually bit us) ───

import { campaignSendSchema } from '@/app/lib/schemas'

describe('campaignSendSchema — email edge cases', () => {
  it('accepts lead with null email', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', phone: '2015551234', email: null }],
      channel: 'whatsapp',
    })
    expect(result.success).toBe(true)
  })

  it('accepts lead with missing email field', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', phone: '2015551234' }],
      channel: 'whatsapp',
    })
    expect(result.success).toBe(true)
  })

  it('accepts lead with empty string email', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', phone: '2015551234', email: '' }],
      channel: 'whatsapp',
    })
    expect(result.success).toBe(true)
  })

  it('accepts lead with valid email', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', email: 'test@example.com' }],
      channel: 'email',
    })
    expect(result.success).toBe(true)
  })

  it('rejects lead with invalid email format', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', email: 'not-valid' }],
      channel: 'email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts messageTemplate field', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ phone: '2015551234' }],
      channel: 'whatsapp',
      messageTemplate: 'Hi {{firstName}}, this is {{agentName}} about {{address}}.',
    })
    expect(result.success).toBe(true)
  })

  it('strips extra fields from leads (like score)', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ id: '550e8400-e29b-41d4-a716-446655440000', phone: '2015551234', score: 85, score_category: 'Hot' }],
      channel: 'whatsapp',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data.leads[0] as Record<string, unknown>).score).toBeUndefined()
    }
  })
})

// ─── Conversations query ordering ───

describe('Conversations ordering', () => {
  it('conversations API orders by last_contacted not last_response', async () => {
    // This is a code review test — verify the route file has the correct ordering
    const fs = await import('fs')
    const routeContent = fs.readFileSync(
      '/Users/karimhossien/Desktop/realestate-ai/app/api/conversations/route.ts',
      'utf-8'
    )

    // The bug: ordering by last_response hid recently-contacted leads
    expect(routeContent).toContain("'last_contacted'")
    expect(routeContent).not.toMatch(/order\(\s*['"]last_response['"]/)
  })
})

// ─── Campaign leads endpoint ───

describe('Campaign leads endpoint data format', () => {
  it('returns null for missing email, not empty string', async () => {
    const fs = await import('fs')
    const routeContent = fs.readFileSync(
      '/Users/karimhossien/Desktop/realestate-ai/app/api/campaigns/leads/route.ts',
      'utf-8'
    )

    // The bug: email: l.email || '' turned null into "" which failed Zod
    expect(routeContent).toContain("l.email || null")
    expect(routeContent).not.toContain("l.email || ''")
  })
})
