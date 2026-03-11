import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'
import { z } from 'zod'

const VALID_TONES = ['professional', 'casual', 'friendly', 'formal', 'luxury'] as const
const VALID_CLOSING_STYLES = ['direct', 'soft', 'consultative', 'urgent'] as const
const VALID_PROPERTY_FOCUSES = ['residential', 'commercial', 'luxury', 'industrial', 'general'] as const

const updateSchema = z.object({
  tone: z.enum(VALID_TONES).optional(),
  language: z.string().max(50).optional(),
  introduction_template: z.string().max(1000).nullable().optional(),
  qualification_questions: z.array(z.string().max(500)).max(10).optional(),
  escalation_message: z.string().max(1000).nullable().optional(),
  closing_style: z.enum(VALID_CLOSING_STYLES).optional(),
  property_focus: z.enum(VALID_PROPERTY_FOCUSES).optional(),
  custom_instructions: z.string().max(2000).nullable().optional(),
  active: z.boolean().optional(),
})

/**
 * GET /api/settings/ai-script
 * Fetch the current user's AI script configuration.
 */
export async function GET() {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: config, error } = await supabase
      .from('ai_config')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Return default config if none exists
    const result = config || {
      tone: 'professional',
      language: 'english',
      introduction_template: null,
      qualification_questions: [],
      escalation_message: null,
      closing_style: 'direct',
      property_focus: 'general',
      custom_instructions: null,
      active: true,
    }

    return NextResponse.json({ ok: true, config: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * PUT /api/settings/ai-script
 * Create or update the user's AI script configuration (upsert).
 */
export async function PUT(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: config, error } = await supabase
      .from('ai_config')
      .upsert(
        { user_id: auth.user.id, ...parsed.data },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, config })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
