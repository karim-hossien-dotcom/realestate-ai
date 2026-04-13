import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'
import { z } from 'zod'
import { validateDayOffsets } from '@/app/lib/cadence/templates'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  day_offsets: z.array(z.number().int().min(1).max(365)).min(1).max(20),
  lead_type: z.string().max(50).nullable().optional(),
  is_default: z.boolean().optional(),
})

/**
 * GET /api/cadence-templates
 * List all custom cadence templates for the current user.
 */
export async function GET() {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: templates, error } = await supabase
      .from('cadence_templates')
      .select('*')
      .eq('user_id', auth.user.id)
      // Most recently created first — most relevant for the dropdown
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, templates: templates ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/cadence-templates
 * Create a new custom cadence template for the current user.
 */
export async function POST(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createSchema.safeParse(raw)
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

    // Validate day offsets business rules (ascending, no duplicates, etc.)
    const offsetValidation = validateDayOffsets(parsed.data.day_offsets)
    if (!offsetValidation.ok) {
      return NextResponse.json({ ok: false, error: offsetValidation.error }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: template, error } = await supabase
      .from('cadence_templates')
      .insert({
        user_id: auth.user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        day_offsets: parsed.data.day_offsets,
        lead_type: parsed.data.lead_type ?? null,
        is_default: parsed.data.is_default ?? false,
      })
      .select()
      .single()

    if (error) {
      // Unique constraint on (user_id, name)
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: 'A template with this name already exists.' },
          { status: 409 }
        )
      }
      await logActivity(
        auth.user.id,
        'cadence_template.create',
        `Failed to create cadence template: ${error.message}`,
        'failed',
        { error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'cadence_template.create',
      `Created cadence template: ${template.name}`,
      'success',
      { templateId: template.id }
    )

    return NextResponse.json({ ok: true, template }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
