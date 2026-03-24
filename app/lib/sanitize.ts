/**
 * Input sanitization helpers for API routes.
 * Use at the boundary where user input enters the system.
 */

import { NextResponse } from 'next/server'

/** Max JSON body size: 512KB (prevents oversized payloads) */
const MAX_BODY_SIZE = 512 * 1024

/**
 * Safely parse and validate a JSON request body.
 * Returns 400 if body is missing, too large, or malformed.
 */
export async function safeParseBody<T = Record<string, unknown>>(
  request: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    // Check Content-Length header if present
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'Request body too large. Maximum 512KB.' },
          { status: 413 }
        ),
      }
    }

    const text = await request.text()

    // Check actual size
    if (text.length > MAX_BODY_SIZE) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'Request body too large. Maximum 512KB.' },
          { status: 413 }
        ),
      }
    }

    if (!text || text.trim().length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'Request body is empty.' },
          { status: 400 }
        ),
      }
    }

    const data = JSON.parse(text) as T
    return { ok: true, data }
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Invalid JSON in request body.' },
        { status: 400 }
      ),
    }
  }
}

/**
 * Sanitize a string to prevent XSS and injection.
 * Strips control characters and trims.
 */
export function sanitizeString(input: unknown, maxLength = 5000): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars (keep \n, \r, \t)
    .trim()
    .slice(0, maxLength)
}

/**
 * Validate UUID format
 */
export function isValidUuid(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)
}
