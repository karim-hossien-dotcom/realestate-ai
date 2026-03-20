import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/app/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { createServiceClient } from '@/app/lib/supabase/server'
import { isOnNationalDnc, scrubAgainstNationalDnc } from '@/app/lib/messaging/dnc-registry'

function mockSupabase(queryResult: { data: unknown[] | null; error: unknown | null }) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(queryResult),
  }
  return chain
}

describe('isOnNationalDnc()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when number is on registry', async () => {
    const mock = mockSupabase({ data: [{ phone: '2125551234' }], error: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    const result = await isOnNationalDnc('+12125551234')
    expect(result).toBe(true)
  })

  it('returns false when number is not on registry', async () => {
    const mock = mockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    const result = await isOnNationalDnc('+12125559999')
    expect(result).toBe(false)
  })

  it('returns false for non-US number (not 10 digits)', async () => {
    // Non-US numbers should skip the DB check entirely
    const result = await isOnNationalDnc('+442071234567')
    expect(result).toBe(false)
  })

  it('returns false for short numbers', async () => {
    const result = await isOnNationalDnc('12345')
    expect(result).toBe(false)
  })

  it('fails closed on DB error (returns true)', async () => {
    const mock = mockSupabase({ data: null, error: { message: 'DB connection failed' } })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    const result = await isOnNationalDnc('+12125551234')
    expect(result).toBe(true) // Fail closed — don't send
  })

  it('strips +1 prefix correctly', async () => {
    const mock = mockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    await isOnNationalDnc('+12125551234')
    expect(mock.eq).toHaveBeenCalledWith('phone', '2125551234')
  })

  it('strips leading 1 from 11-digit numbers', async () => {
    const mock = mockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    await isOnNationalDnc('12125551234')
    expect(mock.eq).toHaveBeenCalledWith('phone', '2125551234')
  })

  it('handles 10-digit numbers without prefix', async () => {
    const mock = mockSupabase({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue(mock as never)

    await isOnNationalDnc('2125551234')
    expect(mock.eq).toHaveBeenCalledWith('phone', '2125551234')
  })
})

describe('scrubAgainstNationalDnc()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty set for empty input', async () => {
    const result = await scrubAgainstNationalDnc([])
    expect(result.size).toBe(0)
  })

  it('returns empty set when no US numbers', async () => {
    const result = await scrubAgainstNationalDnc(['+442071234567', '+33123456789'])
    expect(result.size).toBe(0)
  })

  it('returns blocked numbers in original format', async () => {
    const mock = mockSupabase({ data: [{ phone: '2125551234' }], error: null })

    // scrubAgainstNationalDnc calls .in() instead of .limit()
    // Adjust the mock to work with the batch query pattern
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnValue({ data: [{ phone: '2125551234' }], error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as never)

    const result = await scrubAgainstNationalDnc(['+12125551234', '+13475551234'])
    expect(result.has('+12125551234')).toBe(true)
    expect(result.has('+13475551234')).toBe(false)
  })

  it('returns empty set when no numbers are blocked', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnValue({ data: [], error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as never)

    const result = await scrubAgainstNationalDnc(['+12125551234', '+13475551234'])
    expect(result.size).toBe(0)
  })

  it('blocks entire chunk on DB error', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as never)

    const phones = ['+12125551234', '+13475551234']
    const result = await scrubAgainstNationalDnc(phones)
    // Both should be blocked (fail closed)
    expect(result.has('+12125551234')).toBe(true)
    expect(result.has('+13475551234')).toBe(true)
  })

  it('filters out non-US numbers from batch', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnValue({ data: [], error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as never)

    const phones = ['+12125551234', '+442071234567', '+13475551234']
    const result = await scrubAgainstNationalDnc(phones)
    // Only US numbers should be queried
    const queriedNumbers = chain.in.mock.calls[0]?.[1]
    expect(queriedNumbers).not.toContain('442071234567')
    expect(result.size).toBe(0)
  })

  it('handles mixed blocked and clean numbers', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnValue({ data: [{ phone: '2125551234' }, { phone: '7185551234' }], error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(chain as never)

    const result = await scrubAgainstNationalDnc(['+12125551234', '+13475559999', '+17185551234'])
    expect(result.size).toBe(2)
    expect(result.has('+12125551234')).toBe(true)
    expect(result.has('+17185551234')).toBe(true)
    expect(result.has('+13475559999')).toBe(false)
  })
})
