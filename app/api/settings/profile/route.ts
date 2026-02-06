import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

/**
 * GET /api/settings/profile
 * Fetch current user's profile
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, company, phone, created_at, updated_at')
    .eq('id', auth.user.id)
    .single()

  if (error) {
    console.error('[Settings] Profile fetch error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, profile })
}

/**
 * PATCH /api/settings/profile
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  let body: { full_name?: string; company?: string; phone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Only allow updating these fields
  const allowedFields = ['full_name', 'company', 'phone']
  const updates: Record<string, string> = {}

  for (const field of allowedFields) {
    if (field in body && typeof body[field as keyof typeof body] === 'string') {
      updates[field] = (body[field as keyof typeof body] as string).trim()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', auth.user.id)
    .select('id, email, full_name, company, phone, created_at, updated_at')
    .single()

  if (error) {
    console.error('[Settings] Profile update error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to update profile' },
      { status: 500 }
    )
  }

  // Log the activity
  await logActivity(
    auth.user.id,
    'profile_updated',
    `Profile updated: ${Object.keys(updates).join(', ')}`,
    'success',
    { fields: Object.keys(updates) }
  )

  return NextResponse.json({ ok: true, profile })
}
