import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'
import { z } from 'zod'
import { validateDayOffsets } from '@/app/lib/cadence/templates'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  day_offsets: z.array(z.number().int().min(1).max(365)).min(1).max(20).optional(),
  lead_type: z.string().max(50).nullable().optional(),
  is_default: z.boolean().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PUT /api/cadence-templates/[id]
 * Update a cadence template owned by the current user.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { id } = await params

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      )
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
    }

    // Validate day_offsets if provided
    if (parsed.data.day_offsets) {
      const offsetValidation = validateDayOffsets(parsed.data.day_offsets)
      if (!offsetValidation.ok) {
        return NextResponse.json({ ok: false, error: offsetValidation.error }, { status: 400 })
      }
    }

    const supabase = createServiceClient()

    const { data: template, error } = await supabase
      .from('cadence_templates')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Template not found or access denied' },
          { status: 404 }
        )
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'A template with this name already exists.' },
          { status: 409 }
        )
      }
      await logActivity(
        auth.user.id,
        'cadence_template.update',
        `Failed to update cadence template ${id}: ${error.message}`,
        'failed',
        { templateId: id, error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'cadence_template.update',
      `Updated cadence template: ${template.name}`,
      'success',
      { templateId: id, fields: Object.keys(parsed.data) }
    )

    return NextResponse.json({ ok: true, template })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/cadence-templates/[id]
 * Delete a cadence template owned by the current user.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const supabase = createServiceClient()

    // Fetch first to confirm ownership before deleting
    const { data: existing, error: fetchError } = await supabase
      .from('cadence_templates')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, error: 'Template not found or access denied' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('cadence_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)

    if (error) {
      await logActivity(
        auth.user.id,
        'cadence_template.delete',
        `Failed to delete cadence template ${id}: ${error.message}`,
        'failed',
        { templateId: id, error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'cadence_template.delete',
      `Deleted cadence template: ${existing.name}`,
      'success',
      { templateId: id }
    )

    return NextResponse.json({ ok: true, deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
