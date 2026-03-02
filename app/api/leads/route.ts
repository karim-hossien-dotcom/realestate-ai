import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, leads: [] },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    leads: leads || [],
    total: leads?.length || 0,
    source: 'supabase',
  })
}

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      user_id: auth.user.id,
      property_address: body.property_address,
      owner_name: body.owner_name,
      phone: body.phone,
      email: body.email,
      contact_preference: body.contact_preference || 'sms',
      status: body.status || 'new',
      notes: body.notes,
      tags: body.tags || [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, lead })
}

export async function PATCH(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Lead ID is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, lead })
}

export async function DELETE(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Lead ID is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
