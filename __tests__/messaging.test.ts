import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Resend SDK to avoid API key requirement at import time
vi.mock('resend', () => {
  class MockResend {
    emails = { send: vi.fn() }
  }
  return { Resend: MockResend }
})

// ---------- WhatsApp Tests ----------

describe('sendWhatsAppText()', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id'
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns error when credentials missing', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN

    // Re-import to pick up env changes (module reads env at call time)
    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    const result = await sendWhatsAppText({ to: '+12125551234', body: 'Hello' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.error).toContain('credentials')
  })

  it('strips leading + from phone number', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_123' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppText({ to: '+12125551234', body: 'Hello' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.to).toBe('12125551234')
  })

  it('returns messageId on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_abc123' }] }),
    }))

    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    const result = await sendWhatsAppText({ to: '12125551234', body: 'Hi' })

    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('wamid_abc123')
    expect(result.status).toBe(200)
  })

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid token' } }),
    }))

    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    const result = await sendWhatsAppText({ to: '12125551234', body: 'Hi' })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toBe('Invalid token')
  })

  it('sends correct payload structure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_1' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppText({ to: '12125551234', body: 'Test message' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.messaging_product).toBe('whatsapp')
    expect(body.type).toBe('text')
    expect(body.text.body).toBe('Test message')
  })

  it('calls correct Meta API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_1' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppText } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppText({ to: '12125551234', body: 'Hi' })

    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://graph.facebook.com/v21.0/test-phone-id/messages'
    )
  })
})

describe('sendWhatsAppTemplate()', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id'
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('uses default template name when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_t1' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppTemplate } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppTemplate({ to: '12125551234' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.type).toBe('template')
    expect(body.template.name).toBe('realestate_outreach')
  })

  it('uses custom template name when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_t2' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppTemplate } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppTemplate({ to: '12125551234', templateName: 'property_inquiry' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.template.name).toBe('property_inquiry')
  })

  it('includes body parameters when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_t3' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppTemplate } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppTemplate({
      to: '12125551234',
      bodyParams: ['Hello World', 'Nadine'],
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.template.components).toHaveLength(1)
    expect(body.template.components[0].type).toBe('body')
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Hello World' },
      { type: 'text', text: 'Nadine' },
    ])
  })

  it('omits components when no bodyParams', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ messages: [{ id: 'wamid_t4' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWhatsAppTemplate } = await import('@/app/lib/messaging/whatsapp')
    await sendWhatsAppTemplate({ to: '12125551234' })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.template.components).toBeUndefined()
  })
})

// ---------- SMS Tests ----------

describe('sendSms()', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns demo mode when credentials missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_PHONE_NUMBER

    const { sendSms } = await import('@/app/lib/messaging/sms')
    const result = await sendSms({ to: '+12125551234', body: 'Hello' })

    expect(result.ok).toBe(true)
    expect(result.messageId).toMatch(/^demo-sms-/)
  })

  it('adds + prefix if missing', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'token123'
    process.env.TWILIO_PHONE_NUMBER = '+18005551234'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendSms } = await import('@/app/lib/messaging/sms')
    await sendSms({ to: '12125551234', body: 'Hi' })

    const body = mockFetch.mock.calls[0][1].body
    expect(body).toContain('To=%2B12125551234')
  })

  it('keeps + prefix if already present', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'token123'
    process.env.TWILIO_PHONE_NUMBER = '+18005551234'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM456' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendSms } = await import('@/app/lib/messaging/sms')
    await sendSms({ to: '+12125551234', body: 'Hi' })

    const body = mockFetch.mock.calls[0][1].body
    expect(body).toContain('To=%2B12125551234')
  })

  it('returns messageId on success', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'token123'
    process.env.TWILIO_PHONE_NUMBER = '+18005551234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM789' }),
    }))

    const { sendSms } = await import('@/app/lib/messaging/sms')
    const result = await sendSms({ to: '+12125551234', body: 'Hi' })

    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('SM789')
  })

  it('returns error on API failure', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'token123'
    process.env.TWILIO_PHONE_NUMBER = '+18005551234'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: 'Invalid phone number' }),
    }))

    const { sendSms } = await import('@/app/lib/messaging/sms')
    const result = await sendSms({ to: 'invalid', body: 'Hi' })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Invalid phone number')
  })

  it('uses Basic auth with base64 credentials', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'token123'
    process.env.TWILIO_PHONE_NUMBER = '+18005551234'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM1' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendSms } = await import('@/app/lib/messaging/sms')
    await sendSms({ to: '+12125551234', body: 'Hi' })

    const authHeader = mockFetch.mock.calls[0][1].headers.Authorization
    const expected = `Basic ${Buffer.from('AC123:token123').toString('base64')}`
    expect(authHeader).toBe(expected)
  })
})

// ---------- Email Template Tests ----------

describe('generateOutreachEmail()', () => {
  // Use dynamic import to avoid Resend SDK initialization issues
  it('generates correct subject', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John Doe',
      propertyAddress: '123 Main St',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
    })
    expect(result.subject).toBe('Regarding your property at 123 Main St')
  })

  it('escapes HTML entities in recipient name', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: '<script>alert("xss")</script>',
      propertyAddress: '123 Main St',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
    })
    expect(result.html).not.toContain('<script>')
    expect(result.html).toContain('&lt;script&gt;')
  })

  it('includes unsubscribe URL when userId provided', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      userId: 'user-123',
    })
    expect(result.html).toContain('/api/email/unsubscribe')
    expect(result.html).toContain('user-123')
  })

  it('uses # for unsubscribe when no userId', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
    })
    expect(result.html).toContain('href="#"')
  })

  it('includes company info', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
    })
    expect(result.html).toContain('EYWA Consulting Services Inc')
    expect(result.html).toContain('Hoboken')
  })

  it('uses custom message when provided', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      customMessage: 'Special offer for you!',
    })
    expect(result.html).toContain('Special offer for you!')
    expect(result.text).toContain('Special offer for you!')
  })

  it('generates both html and text versions', async () => {
    const { generateOutreachEmail } = await import('@/app/lib/messaging/email')
    const result = generateOutreachEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
    })
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.text).toContain('Hi John')
    expect(result.text).toContain('Nadine')
  })
})

describe('generateFollowUpEmail()', () => {
  it('uses first subject for followUpNumber 1', async () => {
    const { generateFollowUpEmail } = await import('@/app/lib/messaging/email')
    const result = generateFollowUpEmail({
      recipientName: 'John',
      propertyAddress: '123 Main St',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      followUpNumber: 1,
    })
    expect(result.subject).toContain('Following up')
    expect(result.subject).toContain('123 Main St')
  })

  it('uses second subject for followUpNumber 2', async () => {
    const { generateFollowUpEmail } = await import('@/app/lib/messaging/email')
    const result = generateFollowUpEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      followUpNumber: 2,
    })
    expect(result.subject).toContain('check-in')
  })

  it('uses third subject for followUpNumber 3', async () => {
    const { generateFollowUpEmail } = await import('@/app/lib/messaging/email')
    const result = generateFollowUpEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      followUpNumber: 3,
    })
    expect(result.subject).toContain('Still interested')
  })

  it('caps at third variant for followUpNumber > 3', async () => {
    const { generateFollowUpEmail } = await import('@/app/lib/messaging/email')
    const result = generateFollowUpEmail({
      recipientName: 'John',
      propertyAddress: '123 Main',
      agentName: 'Nadine',
      agentPhone: '555-1234',
      agentEmail: 'nadine@kw.com',
      followUpNumber: 10,
    })
    expect(result.subject).toContain('Still interested')
  })
})
