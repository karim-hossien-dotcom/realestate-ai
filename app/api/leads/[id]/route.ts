import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

// GET /api/leads/[id] - Get a single lead
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const supabase = createServiceClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, lead })
}

// PATCH /api/leads/[id] - Update lead details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()

  // Only allow updating these fields
  const allowedFields = [
    'property_address',
    'owner_name',
    'phone',
    'email',
    'contact_preference',
    'status',
    'notes',
    'tags',
    'score',
    'score_category',
    'property_interest',
    'budget_min',
    'budget_max',
    'property_type',
    'location_preference'
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const supabase = createServiceClient()

  // Verify ownership first
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single()

  if (!existingLead) {
    return NextResponse.json({ ok: false, error: 'Lead not found' }, { status: 404 })
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating lead:', error)
    return NextResponse.json({ ok: false, error: 'Failed to update lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead })
}
