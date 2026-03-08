import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'
import { parseBody, success, error, checkPhoneTaken } from '@/app/lib/api'
import { createLeadSchema, updateLeadSchema } from '@/app/lib/schemas'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { data: leads, error: dbError } = await supabase
    .from('leads')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (dbError) {
    return error(dbError.message, 500)
  }

  return success({ leads: leads || [], total: leads?.length || 0 })
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
      return error(
        `This phone number is already assigned to a lead owned by ${dup.ownerName}. Each lead can only belong to one agent.`,
        409
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
    return error(dbError.message, 500)
  }

  return success({ lead }, 201)
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
    return error(dbError.message, 500)
  }

  return success({ lead })
}

export async function DELETE(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return error('Lead ID is required', 400)
  }

  const supabase = await createClient()

  const { error: dbError } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (dbError) {
    return error(dbError.message, 500)
  }

  return success({ deleted: true })
}
