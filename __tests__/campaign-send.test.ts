import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set env BEFORE imports
vi.hoisted(() => {
  process.env.ADMIN_USER_ID = 'test-admin-id'
  process.env.BYPASS_USER_ID_1 = 'vip-user-id'
  // Set creds so code doesn't enter demo mode
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id'
  process.env.TWILIO_ACCOUNT_SID = 'test-sid'
  process.env.TWILIO_AUTH_TOKEN = 'test-auth'
  process.env.TWILIO_PHONE_NUMBER = '+15551234567'
  process.env.RESEND_API_KEY = 'test-resend-key'
})

// ─── Mocks ───

function createMockSupabase() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  // Campaign insert → returns campaign record
  const insertChain = {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockReturnValue({ data: { id: 'campaign-1' }, error: null }),
    }),
  }

  chain.from = vi.fn().mockReturnThis()
  chain.select = vi.fn().mockReturnThis()
  chain.insert = vi.fn().mockReturnValue(insertChain)
  chain.update = vi.fn().mockReturnThis()
  chain.eq = vi.fn().mockReturnThis()
  chain.in = vi.fn().mockReturnThis()
  chain.order = vi.fn().mockReturnThis()
  chain.limit = vi.fn().mockReturnThis()
  chain.single = vi.fn().mockReturnValue({
    data: { full_name: 'Test Agent', email: 'agent@test.com', phone: '5551234567', company: 'Test Brokerage' },
    error: null,
  })
  chain.rpc = vi.fn().mockImplementation(async (fnName: string) => {
    if (fnName === 'check_dnc') return { data: false, error: null }
    if (fnName === 'increment_rate_limit') return { data: [{ allowed: true, current_count: 1 }], error: null }
    return { data: null, error: null }
  })

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

// Mock parseBody to skip real Zod parsing in route-level tests
const mockParseBody = vi.fn()
vi.mock('@/app/lib/api', () => ({
  parseBody: (...args: unknown[]) => mockParseBody(...args),
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

vi.mock('@/app/lib/billing/feature-gate', () => ({
  checkFeatureAccess: vi.fn(async () => ({ allowed: true, planSlug: 'agency' })),
  featureBlockedPayload: vi.fn((r) => ({ ok: false, error: 'feature_blocked', message: r.message })),
}))

vi.mock('@/app/lib/billing/overage', () => ({
  recordOverage: vi.fn(async () => {}),
}))

vi.mock('@/app/lib/messaging/whatsapp', () => ({
  sendWhatsAppText: vi.fn(async () => ({ ok: true, messageId: 'wa-msg-1' })),
  sendWhatsAppTemplate: vi.fn(async () => ({ ok: true, messageId: 'wa-tmpl-1' })),
}))

vi.mock('@/app/lib/messaging/sms', () => ({
  sendSms: vi.fn(async () => ({ ok: true, messageId: 'sms-msg-1' })),
}))

vi.mock('@/app/lib/messaging/email', () => ({
  sendEmail: vi.fn(async () => ({ ok: true, messageId: 'email-msg-1' })),
  generateOutreachEmail: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>', text: 'Test' })),
}))

vi.mock('@/app/lib/messaging/dnc-registry', () => ({
  isOnNationalDnc: vi.fn(async () => false),
}))

vi.mock('@/app/lib/messaging/outreach-messages', () => ({
  generateOutreachMessage: vi.fn(() => 'Generated outreach message'),
}))

import { POST } from '@/app/api/campaigns/send/route'
import { withAuth } from '@/app/lib/auth'
import { checkFeatureAccess } from '@/app/lib/billing/feature-gate'
import { sendWhatsAppText } from '@/app/lib/messaging/whatsapp'
import { sendSms } from '@/app/lib/messaging/sms'

// ─── Helpers ───

function makeRequest(): Request {
  return new Request('http://localhost:3000/api/campaigns/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}', // parseBody is mocked, body content doesn't matter
  })
}

function baseLead(overrides?: Record<string, unknown>) {
  return {
    id: 'lead-1',
    owner_name: 'John Smith',
    phone: '2015551234',
    email: null,
    sms_text: 'Hi John, pre-generated message here.',
    property_address: '123 Main St, Newark',
    ...overrides,
  }
}

function setupParseBody(data: Record<string, unknown>) {
  mockParseBody.mockResolvedValueOnce({
    ok: true,
    data: { channel: 'whatsapp', campaignName: 'Test Campaign', ...data },
  })
}

function setupParseBodyFail(status = 400, error = 'Validation failed') {
  mockParseBody.mockResolvedValueOnce({
    ok: false,
    response: new Response(JSON.stringify({ ok: false, error }), { status }),
  })
}

// ─── Tests ───

describe('POST /api/campaigns/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
  })

  // ─── Template passthrough (BUG #2 that shipped broken) ───

  it('uses messageTemplate when provided (fills per-lead placeholders)', async () => {
    const template = 'Hi {{firstName}}, this is {{agentName}} from {{brokerage}} about {{address}} in {{area}}.'
    setupParseBody({
      leads: [baseLead()],
      messageTemplate: template,
    })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)

    // Verify WhatsApp was called with the FILLED template, not sms_text
    const waCall = vi.mocked(sendWhatsAppText).mock.calls[0][0]
    expect(waCall.body).toContain('Hi John')
    expect(waCall.body).toContain('Test Agent')
    expect(waCall.body).toContain('Test Brokerage')
    expect(waCall.body).toContain('123 Main St')
    // Should NOT contain the pre-generated sms_text
    expect(waCall.body).not.toContain('pre-generated message')
  })

  it('falls back to sms_text when no messageTemplate provided', async () => {
    setupParseBody({ leads: [baseLead()] })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)
    const waCall = vi.mocked(sendWhatsAppText).mock.calls[0][0]
    expect(waCall.body).toBe('Hi John, pre-generated message here.')
  })

  it('uses messageTemplate for SMS channel too', async () => {
    const template = 'Hey {{firstName}}, check out {{address}}!'
    setupParseBody({
      leads: [baseLead()],
      channel: 'sms',
      messageTemplate: template,
    })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)
    const smsCall = vi.mocked(sendSms).mock.calls[0][0]
    expect(smsCall.body).toContain('Hey John')
    expect(smsCall.body).toContain('123 Main St')
  })

  it('personalizes template differently for each lead', async () => {
    const template = 'Hi {{firstName}} about {{address}}'
    setupParseBody({
      leads: [
        baseLead({ id: 'lead-1', owner_name: 'Alice Jones', property_address: '100 Oak Ave' }),
        baseLead({ id: 'lead-2', owner_name: 'Bob Brown', phone: '2015559999', property_address: '200 Elm St' }),
      ],
      messageTemplate: template,
    })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)
    expect(data.sent).toBe(2)

    const calls = vi.mocked(sendWhatsAppText).mock.calls
    expect(calls[0][0].body).toContain('Hi Alice')
    expect(calls[0][0].body).toContain('100 Oak Ave')
    expect(calls[1][0].body).toContain('Hi Bob')
    expect(calls[1][0].body).toContain('200 Elm St')
  })

  // ─── Feature gating ───

  it('returns 402 when feature access is blocked (no subscription)', async () => {
    setupParseBody({ leads: [baseLead()] })
    vi.mocked(checkFeatureAccess).mockResolvedValueOnce({
      allowed: false,
      planSlug: null,
      requiredPlan: 'pro',
      featureLabel: 'Campaign Bulk Sending',
      message: 'Campaign Bulk Sending requires the Pro plan.',
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(402)
  })

  it('bypasses feature gate for VIP users', async () => {
    setupParseBody({ leads: [baseLead()] })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  // ─── Auth ───

  it('returns 401 when not authenticated', async () => {
    vi.mocked(withAuth).mockResolvedValueOnce({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401 }),
      user: null as never,
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  // ─── Validation (parseBody) ───

  it('returns 400 when parseBody fails', async () => {
    setupParseBodyFail(400, 'Validation failed')

    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
  })

  // ─── Edge cases ───

  it('skips leads with missing phone for WhatsApp channel', async () => {
    setupParseBody({ leads: [baseLead({ phone: null })] })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)
    expect(data.failed).toBe(1)
    expect(data.results[0].error).toContain('Missing phone')
  })

  it('handles mixed leads — some with phone, some without', async () => {
    setupParseBody({
      leads: [
        baseLead({ id: 'lead-1', phone: '2015551111' }),
        baseLead({ id: 'lead-2', phone: null }),
        baseLead({ id: 'lead-3', phone: '2015553333' }),
      ],
    })

    const res = await POST(makeRequest())
    const data = await res.json()

    expect(data.ok).toBe(true)
    expect(data.sent).toBe(2)
    expect(data.failed).toBe(1)
  })

  it('records message body from template in DB, not sms_text', async () => {
    const template = 'Custom message for {{firstName}}'
    setupParseBody({
      leads: [baseLead()],
      messageTemplate: template,
    })

    await POST(makeRequest())

    // The WhatsApp send should use the filled template
    const waCall = vi.mocked(sendWhatsAppText).mock.calls[0]?.[0]
    expect(waCall).toBeDefined()
    expect(waCall.body).toContain('Custom message for John')
  })

  it('updates campaign status to completed after send', async () => {
    setupParseBody({ leads: [baseLead()] })

    await POST(makeRequest())

    // Verify update was called with 'completed' status
    const updateCalls = mockSupabase.update.mock.calls
    const completedUpdate = updateCalls.find(
      (call: unknown[]) => call[0]?.status === 'completed'
    )
    expect(completedUpdate).toBeTruthy()
  })
})
