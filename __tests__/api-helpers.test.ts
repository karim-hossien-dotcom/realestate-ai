import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { success, error, parseBody } from '@/app/lib/api'

describe('success()', () => {
  it('returns ok: true with data', () => {
    const res = success({ foo: 'bar' })
    // NextResponse.json returns a Response — check status
    expect(res.status).toBe(200)
  })

  it('accepts custom status code', () => {
    const res = success({ created: true }, 201)
    expect(res.status).toBe(201)
  })
})

describe('error()', () => {
  it('returns ok: false with error message', () => {
    const res = error('Something went wrong', 500)
    expect(res.status).toBe(500)
  })

  it('defaults to 500 status', () => {
    const res = error('Oops')
    expect(res.status).toBe(500)
  })

  it('includes details when provided', async () => {
    const res = error('Validation failed', 400, [{ field: 'name', message: 'required' }])
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toHaveLength(1)
  })
})

describe('parseBody()', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  })

  it('parses valid JSON body', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice', age: 30 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseBody(request, schema)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.name).toBe('Alice')
      expect(result.data.age).toBe(30)
    }
  })

  it('rejects invalid JSON', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseBody(request, schema)
    expect(result.ok).toBe(false)
  })

  it('rejects data that fails validation', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: '', age: -5 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseBody(request, schema)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const body = await result.response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details.length).toBeGreaterThan(0)
    }
  })

  it('rejects missing required fields', async () => {
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseBody(request, schema)
    expect(result.ok).toBe(false)
  })
})
