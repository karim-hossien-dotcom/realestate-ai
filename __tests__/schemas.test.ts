import { describe, it, expect } from 'vitest'
import {
  createLeadSchema,
  updateLeadSchema,
  stripeCheckoutSchema,
  whatsappSendSchema,
  emailSendSchema,
  campaignSendSchema,
} from '@/app/lib/schemas'

describe('createLeadSchema', () => {
  it('validates a valid lead', () => {
    const result = createLeadSchema.safeParse({
      property_address: '123 Main St',
      owner_name: 'John Doe',
      phone: '+15551234567',
      email: 'john@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('requires property_address', () => {
    const result = createLeadSchema.safeParse({
      owner_name: 'John Doe',
    })
    expect(result.success).toBe(false)
  })

  it('requires owner_name', () => {
    const result = createLeadSchema.safeParse({
      property_address: '123 Main St',
    })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = createLeadSchema.parse({
      property_address: '123 Main St',
      owner_name: 'John Doe',
    })
    expect(result.contact_preference).toBe('sms')
    expect(result.status).toBe('new')
    expect(result.tags).toEqual([])
  })

  it('rejects invalid email', () => {
    const result = createLeadSchema.safeParse({
      property_address: '123 Main St',
      owner_name: 'John Doe',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid contact_preference', () => {
    const result = createLeadSchema.safeParse({
      property_address: '123 Main St',
      owner_name: 'John Doe',
      contact_preference: 'pigeon',
    })
    expect(result.success).toBe(false)
  })

  it('rejects too many tags', () => {
    const result = createLeadSchema.safeParse({
      property_address: '123 Main St',
      owner_name: 'John Doe',
      tags: Array(21).fill('tag'),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateLeadSchema', () => {
  it('requires a valid UUID for id', () => {
    const result = updateLeadSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('accepts valid partial update', () => {
    const result = updateLeadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'interested',
      score: 85,
    })
    expect(result.success).toBe(true)
  })

  it('rejects score over 100', () => {
    const result = updateLeadSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      score: 150,
    })
    expect(result.success).toBe(false)
  })
})

describe('stripeCheckoutSchema', () => {
  it('requires priceId', () => {
    const result = stripeCheckoutSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('validates valid priceId', () => {
    const result = stripeCheckoutSchema.safeParse({ priceId: 'price_abc123' })
    expect(result.success).toBe(true)
  })
})

describe('whatsappSendSchema', () => {
  it('requires to field', () => {
    const result = whatsappSendSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('requires body field', () => {
    const result = whatsappSendSchema.safeParse({ to: '+15551234567' })
    expect(result.success).toBe(false)
  })

  it('validates valid send request', () => {
    const result = whatsappSendSchema.safeParse({
      to: '+15551234567',
      body: 'Hello there!',
    })
    expect(result.success).toBe(true)
  })
})

describe('emailSendSchema', () => {
  it('requires at least one leadId', () => {
    const result = emailSendSchema.safeParse({ leadIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID leadIds', () => {
    const result = emailSendSchema.safeParse({ leadIds: ['not-uuid'] })
    expect(result.success).toBe(false)
  })

  it('validates valid email send', () => {
    const result = emailSendSchema.safeParse({
      leadIds: ['550e8400-e29b-41d4-a716-446655440000'],
      customMessage: 'Hello!',
    })
    expect(result.success).toBe(true)
  })
})

describe('campaignSendSchema', () => {
  it('requires at least one lead', () => {
    const result = campaignSendSchema.safeParse({ leads: [] })
    expect(result.success).toBe(false)
  })

  it('defaults channel to whatsapp', () => {
    const result = campaignSendSchema.parse({
      leads: [{ phone: '+1555' }],
    })
    expect(result.channel).toBe('whatsapp')
  })

  it('rejects invalid channel', () => {
    const result = campaignSendSchema.safeParse({
      leads: [{ phone: '+1555' }],
      channel: 'telegram',
    })
    expect(result.success).toBe(false)
  })

  it('validates full campaign request', () => {
    const result = campaignSendSchema.safeParse({
      leads: [
        { id: '550e8400-e29b-41d4-a716-446655440000', phone: '+1555', owner_name: 'John' },
      ],
      channel: 'sms',
      campaignName: 'Test Campaign',
    })
    expect(result.success).toBe(true)
  })
})
