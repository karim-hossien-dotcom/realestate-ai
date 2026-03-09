import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'
import { parseBody, checkPhoneTaken } from '@/app/lib/api'
import { createLeadSchema, updateLeadSchema } from '@/app/lib/schemas'

export async function GET(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)
  const from = (page - 1) * limit
  const to = from + limit - 1

  const supabase = await createClient()

  // Get total count
  const { count: total } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)

  // Get paginated leads
  const { data: leads, error: dbError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    leads: leads || [],
    total: total || 0,
    page,
    limit,
    totalPages: Math.ceil((total || 0) / limit),
  })
}

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, createLeadSchema)
  if (!parsed.ok) return parsed.response

  // Check if phone already belongs to another agent's lead
  if (parsed.data.phone) {
    const dup = await checkPhoneTaken(parsed.data.phone, auth.user.id)
    if (dup.taken) {
      return NextResponse.json(
        { ok: false, error: `This phone number is already assigned to a lead owned by ${dup.ownerName}. Each lead can only belong to one agent.` },
        { status: 409 }
      )
    }
  }

  const supabase = await createClient()

  const { data: lead, error: dbError } = await supabase
    .from('leads')
    .insert({
      user_id: auth.user.id,
      ...parsed.data,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead }, { status: 201 })
}

export async function PATCH(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, updateLeadSchema)
  if (!parsed.ok) return parsed.response

  const { id, ...updates } = parsed.data

  const supabase = await createClient()

  const { data: lead, error: dbError } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead })
}

export async function DELETE(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  // Support batch delete via JSON body: { ids: ["id1", "id2", ...] }
  if (!id) {
    try {
      const body = await request.json()
      const ids = body?.ids as string[] | undefined
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ ok: false, error: 'Lead ID or ids[] required' }, { status: 400 })
      }
      if (ids.length > 200) {
        return NextResponse.json({ ok: false, error: 'Max 200 leads per batch delete' }, { status: 400 })
      }

      const supabase = await createClient()
      const { error: dbError } = await supabase
        .from('leads')
        .delete()
        .in('id', ids)
        .eq('user_id', auth.user.id)

      if (dbError) {
        return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, deleted: ids.length })
    } catch {
      return NextResponse.json({ ok: false, error: 'Lead ID or ids[] required' }, { status: 400 })
    }
  }

  const supabase = await createClient()

  const { error: dbError } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (dbError) {
    return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: true })
}
