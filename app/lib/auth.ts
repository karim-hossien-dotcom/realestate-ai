import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

export type AuthUser = {
  id: string
  email: string
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; response: NextResponse }

/**
 * Helper to authenticate API routes
 * Returns the authenticated user or an error response
 */
export async function withAuth(): Promise<AuthResult> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email || '',
    }
  }
}

/**
 * Log an activity to the activity_logs table
 */
export async function logActivity(
  userId: string,
  eventType: string,
  description: string,
  status: 'success' | 'failed' | 'pending' = 'success',
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient()

  await supabase.from('activity_logs').insert({
    user_id: userId,
    event_type: eventType,
    description,
    status,
    metadata: metadata || null,
  })
}
