import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'
import { createServiceClient } from '@/app/lib/supabase/server'

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
/**
 * Check if a phone number already belongs to a lead owned by a different user.
 * Uses service role client to bypass RLS and search across all users.
 * Returns the owner's name if taken, or null if available.
 */
export async function checkPhoneTaken(
  phone: string,
  currentUserId: string
): Promise<{ taken: boolean; ownerName?: string }> {
  if (!phone) return { taken: false }

  const normalized = phone.replace(/^\+/, '')
  const admin = createServiceClient()

  const { data } = await admin
    .from('leads')
    .select('user_id, profiles!inner(full_name)')
    .or(`phone.eq.${normalized},phone.eq.+${normalized}`)
    .neq('user_id', currentUserId)
    .limit(1)

  if (data && data.length > 0) {
    const profile = data[0].profiles as unknown as { full_name: string } | null
    return { taken: true, ownerName: profile?.full_name || 'another agent' }
  }
  return { taken: false }
}

/**
 * Batch-check multiple phone numbers for cross-user duplicates.
 * Returns a map of phone → owner name for any that are taken.
 */
export async function checkPhonesTaken(
  phones: string[],
  currentUserId: string
): Promise<Map<string, string>> {
  const taken = new Map<string, string>()
  if (phones.length === 0) return taken

  const normalized = phones.filter(Boolean).map(p => p.replace(/^\+/, ''))
  if (normalized.length === 0) return taken

  const admin = createServiceClient()

  // Build OR filter for all phones (both with and without +)
  const conditions = normalized.map(p => `phone.eq.${p},phone.eq.+${p}`).join(',')

  const { data } = await admin
    .from('leads')
    .select('phone, user_id, profiles!inner(full_name)')
    .or(conditions)
    .neq('user_id', currentUserId)

  if (data) {
    for (const row of data) {
      const profile = row.profiles as unknown as { full_name: string } | null
      const ownerName = profile?.full_name || 'another agent'
      const rawPhone = (row.phone || '').replace(/^\+/, '')
      taken.set(rawPhone, ownerName)
    }
  }
  return taken
}

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
