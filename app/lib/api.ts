import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'

/**
 * Standard API response envelope
 */
interface ApiSuccess<T> {
  ok: true
  data: T
}

interface ApiError {
  ok: false
  error: string
  details?: unknown
}

type ApiResponse<T> = ApiSuccess<T> | ApiError

export function success<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status })
}

export function error(message: string, status = 500, details?: unknown): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ ok: false, error: message, ...(details ? { details } : {}) }, { status })
}

/**
 * Parse and validate request body with a Zod schema.
 * Returns parsed data or a NextResponse error.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: error('Invalid JSON body', 400) }
  }

  try {
    const data = schema.parse(raw)
    return { ok: true, data }
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        response: error('Validation failed', 400, err.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        }))),
      }
    }
    return { ok: false, response: error('Invalid request body', 400) }
  }
}
