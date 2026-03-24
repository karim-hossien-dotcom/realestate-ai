import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { parseBody } from '@/app/lib/api'
import { createCustomTemplateSchema, updateCustomTemplateSchema } from '@/app/lib/schemas'
import { createClient } from '@/app/lib/supabase/server'
import { checkFeatureAccess, featureBlockedPayload } from '@/app/lib/billing/feature-gate'

/**
 * GET /api/campaigns/templates/custom
 * List user's custom templates
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const { data: templates, error } = await supabase
    .from('custom_templates')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('is_favorite', { ascending: false })
    .order('use_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, templates: templates || [] })
}

/**
 * POST /api/campaigns/templates/custom
 * Create a custom template (Pro/Agency only)
 */
export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  // Feature gate: custom templates require Pro+
  const access = await checkFeatureAccess(auth.user.id, 'campaigns')
  if (!access.allowed) {
    return NextResponse.json(featureBlockedPayload(access), { status: 402 })
  }

  const parsed = await parseBody(request, createCustomTemplateSchema)
  if (!parsed.ok) return parsed.response

  const supabase = await createClient()
  const { data: template, error } = await supabase
    .from('custom_templates')
    .insert({ user_id: auth.user.id, ...parsed.data })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await logActivity(auth.user.id, 'template_created', `Created custom template: ${parsed.data.name}`, 'success')
  return NextResponse.json({ ok: true, template }, { status: 201 })
}

/**
 * PATCH /api/campaigns/templates/custom
 * Update a custom template
 */
export async function PATCH(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, updateCustomTemplateSchema)
  if (!parsed.ok) return parsed.response

  const { id, ...updates } = parsed.data
  const supabase = await createClient()

  const { data: template, error } = await supabase
    .from('custom_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, template })
}

/**
 * DELETE /api/campaigns/templates/custom
 * Delete a custom template
 */
export async function DELETE(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  let body: { id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, error: 'Template ID required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('custom_templates')
    .delete()
    .eq('id', body.id)
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await logActivity(auth.user.id, 'template_deleted', `Deleted custom template ${body.id}`, 'success')
  return NextResponse.json({ ok: true })
}
