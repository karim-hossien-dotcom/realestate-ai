import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'
import { z } from 'zod'

const VALID_MODES = ['full_auto', 'approval_required', 'manual'] as const
const VALID_TEMPLATES = ['aggressive', 'standard', 'gentle', 'long_haul'] as const

const updateSchema = z.object({
  followup_automation_mode: z.enum(VALID_MODES).optional(),
  followup_approval_window_hours: z.number().int().min(0).max(168).optional(),
  followup_default_template: z.string().max(100).optional(),
  followup_template_by_lead_type: z
    .object({
      buyer: z.string().max(100),
      seller: z.string().max(100),
      investor: z.string().max(100),
      landlord: z.string().max(100),
      tenant: z.string().max(100),
    })
    .optional(),
  followup_quiet_hours_start: z.number().int().min(0).max(23).optional(),
  followup_quiet_hours_end: z.number().int().min(0).max(23).optional(),
  followup_tcpa_enabled: z.boolean().optional(),
  followup_skip_weekends: z.boolean().optional(),
  followup_max_touches: z.number().int().min(1).max(20).optional(),
})

const DEFAULTS = {
  followup_automation_mode: 'full_auto' as const,
  followup_approval_window_hours: 6,
  followup_default_template: 'standard',
  followup_template_by_lead_type: {
    buyer: 'aggressive',
    seller: 'standard',
    investor: 'standard',
    landlord: 'standard',
    tenant: 'gentle',
  },
  followup_quiet_hours_start: 8,
  followup_quiet_hours_end: 21,
  followup_tcpa_enabled: true,
  followup_skip_weekends: false,
  followup_max_touches: 8,
}

/**
 * GET /api/settings/followup-automation
 * Fetch the current user's follow-up automation settings from profiles table.
 */
export async function GET() {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'followup_automation_mode, followup_approval_window_hours, followup_default_template, followup_template_by_lead_type, followup_quiet_hours_start, followup_quiet_hours_end, followup_tcpa_enabled, followup_skip_weekends, followup_max_touches'
      )
      .eq('id', auth.user.id)
      .maybeSingle()

    if (error) {
      await logActivity(
        auth.user.id,
        'followup_automation.settings.get',
        `Failed to fetch follow-up automation settings: ${error.message}`,
        'failed',
        { error: error.message }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // Merge DB values with defaults so missing columns never surface as null
    const settings = {
      followup_automation_mode:
        profile?.followup_automation_mode ?? DEFAULTS.followup_automation_mode,
      followup_approval_window_hours:
        profile?.followup_approval_window_hours ?? DEFAULTS.followup_approval_window_hours,
      followup_default_template:
        profile?.followup_default_template ?? DEFAULTS.followup_default_template,
      followup_template_by_lead_type:
        profile?.followup_template_by_lead_type ?? DEFAULTS.followup_template_by_lead_type,
      followup_quiet_hours_start:
        profile?.followup_quiet_hours_start ?? DEFAULTS.followup_quiet_hours_start,
      followup_quiet_hours_end:
        profile?.followup_quiet_hours_end ?? DEFAULTS.followup_quiet_hours_end,
      followup_tcpa_enabled:
        profile?.followup_tcpa_enabled ?? DEFAULTS.followup_tcpa_enabled,
      followup_skip_weekends:
        profile?.followup_skip_weekends ?? DEFAULTS.followup_skip_weekends,
      followup_max_touches:
        profile?.followup_max_touches ?? DEFAULTS.followup_max_touches,
    }

    return NextResponse.json({ ok: true, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * PUT /api/settings/followup-automation
 * Update the current user's follow-up automation settings in profiles table.
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

    const supabase = createServiceClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(parsed.data)
      .eq('id', auth.user.id)
      .select(
        'followup_automation_mode, followup_approval_window_hours, followup_default_template, followup_template_by_lead_type, followup_quiet_hours_start, followup_quiet_hours_end, followup_tcpa_enabled, followup_skip_weekends, followup_max_touches'
      )
      .single()

    if (error) {
      await logActivity(
        auth.user.id,
        'followup_automation.settings.update',
        `Failed to update follow-up automation settings: ${error.message}`,
        'failed',
        { error: error.message, fields: Object.keys(parsed.data) }
      )
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'followup_automation.settings.update',
      `Updated follow-up automation settings: ${Object.keys(parsed.data).join(', ')}`,
      'success',
      { fields: Object.keys(parsed.data) }
    )

    return NextResponse.json({ ok: true, settings: profile })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

