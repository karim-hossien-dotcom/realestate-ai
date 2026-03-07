import { describe, it, expect } from 'vitest'
import { calculateLeadScore, explainScore } from '@/app/lib/ai/lead-scorer'

describe('calculateLeadScore', () => {
  it('returns base score of 50 for a brand new lead', () => {
    const result = calculateLeadScore({
      responseCount: 0,
      messagesSent: 0,
      hasPhone: false,
      hasEmail: false,
    })
    expect(result.score).toBe(50)
    expect(result.category).toBe('Warm')
  })

  it('adds +30 for any response', () => {
    const result = calculateLeadScore({
      responseCount: 1,
      messagesSent: 1,
      lastResponse: new Date().toISOString(),
      hasPhone: true,
      hasEmail: false,
    })
    expect(result.breakdown.responseBonus).toBe(30)
    // 50 base + 30 response + 3 engagement = 83
    expect(result.score).toBe(83)
    expect(result.category).toBe('Hot')
  })

  it('adds +25 for positive intent status', () => {
    const result = calculateLeadScore({
      status: 'interested',
      responseCount: 0,
      messagesSent: 0,
      hasPhone: true,
      hasEmail: false,
    })
    expect(result.breakdown.intentBonus).toBe(25)
  })

  it('subtracts -20 for negative intent status', () => {
    const result = calculateLeadScore({
      status: 'not_interested',
      responseCount: 0,
      messagesSent: 0,
      hasPhone: true,
      hasEmail: false,
    })
    expect(result.breakdown.intentBonus).toBe(-20)
    expect(result.score).toBe(30)
    expect(result.category).toBe('Cold')
  })

  it('caps engagement bonus at +15', () => {
    const result = calculateLeadScore({
      responseCount: 0,
      messagesSent: 100,
      hasPhone: true,
      hasEmail: false,
    })
    expect(result.breakdown.engagementBonus).toBe(15)
  })

  it('gives +5 for complete contact info', () => {
    const result = calculateLeadScore({
      responseCount: 0,
      messagesSent: 0,
      hasPhone: true,
      hasEmail: true,
    })
    expect(result.breakdown.completenessBonus).toBe(5)
  })

  it('applies time decay after 14 days', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const result = calculateLeadScore({
      responseCount: 0,
      messagesSent: 1,
      lastContacted: thirtyDaysAgo,
      hasPhone: true,
      hasEmail: false,
    })
    // 30 - 14 = 16 days of decay
    expect(result.breakdown.timeDecay).toBe(-16)
  })

  it('clamps score to 0-100', () => {
    // Max possible: 50 + 30 + 25 + 15 + 5 = 125 → clamped to 100
    const result = calculateLeadScore({
      status: 'interested',
      responseCount: 5,
      messagesSent: 10,
      hasPhone: true,
      hasEmail: true,
    })
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.category).toBe('Hot')

    // Min possible: heavily decayed negative intent
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    const result2 = calculateLeadScore({
      status: 'dead',
      responseCount: 0,
      messagesSent: 0,
      lastContacted: oldDate,
      hasPhone: false,
      hasEmail: false,
    })
    expect(result2.score).toBeGreaterThanOrEqual(0)
    expect(result2.category).toBe('Dead')
  })

  it('categorizes correctly at boundaries', () => {
    // Score exactly 80 = Hot
    const hot = calculateLeadScore({
      responseCount: 1, // +30 → 80
      messagesSent: 0,
      hasPhone: false,
      hasEmail: false,
    })
    expect(hot.score).toBe(80)
    expect(hot.category).toBe('Hot')

    // Score exactly 50 = Warm (base score, no modifiers)
    const warm = calculateLeadScore({
      responseCount: 0,
      messagesSent: 0,
      hasPhone: false,
      hasEmail: false,
    })
    expect(warm.score).toBe(50)
    expect(warm.category).toBe('Warm')
  })

  it('penalizes leads with messages sent but no activity', () => {
    const result = calculateLeadScore({
      responseCount: 0,
      messagesSent: 3,
      hasPhone: true,
      hasEmail: false,
    })
    expect(result.breakdown.timeDecay).toBe(-10)
  })

  it('accepts string dates', () => {
    const result = calculateLeadScore({
      responseCount: 1,
      messagesSent: 1,
      lastResponse: new Date().toISOString(),
      hasPhone: true,
      hasEmail: true,
    })
    expect(result.breakdown.timeDecay).toBe(0)
  })
})

describe('explainScore', () => {
  it('produces readable explanation', () => {
    const result = calculateLeadScore({
      status: 'interested',
      responseCount: 1,
      messagesSent: 3,
      hasPhone: true,
      hasEmail: true,
    })
    const explanation = explainScore(result)
    expect(explanation).toContain('Score:')
    expect(explanation).toContain('Hot')
    expect(explanation).toContain('responded')
    expect(explanation).toContain('positive intent')
  })
})
