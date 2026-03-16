import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'
import { z } from 'zod'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

// ===== Validation Schemas =====

const VALID_SOURCES = ['competitor_pricing', 'product_hunt', 'user_feedback', 'trend', 'usage_analysis'] as const
const VALID_FINDING_TYPES = ['competitor_change', 'feature_gap', 'market_trend', 'user_request', 'pricing_change'] as const
const VALID_PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
const VALID_STATUSES = ['new', 'reviewed', 'accepted', 'rejected', 'implemented'] as const

const createFindingSchema = z.object({
  source: z.enum(VALID_SOURCES),
  finding_type: z.enum(VALID_FINDING_TYPES),
  competitor_name: z.string().max(200).optional(),
  summary: z.string().min(1, 'Summary is required').max(2000),
  details: z.record(z.string(), z.unknown()).default({}),
  recommended_action: z.string().max(2000).optional(),
  priority: z.enum(VALID_PRIORITIES).default('P2'),
  status: z.enum(VALID_STATUSES).default('new'),
  engineering_task_id: z.string().uuid().optional(),
})

const updateFindingSchema = z.object({
  id: z.string().uuid('Invalid finding ID'),
  status: z.enum(VALID_STATUSES).optional(),
  priority: z.enum(VALID_PRIORITIES).optional(),
  recommended_action: z.string().max(2000).optional(),
  engineering_task_id: z.string().uuid().nullable().optional(),
})

// ===== Helpers =====

function adminGuard(userId: string): NextResponse | null {
  if (userId !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * GET /api/research/findings
 * List research findings with optional filters.
 * Query params: status, source, finding_type, priority, limit, offset
 */
export async function GET(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const forbidden = adminGuard(auth.user.id)
    if (forbidden) return forbidden

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const findingType = searchParams.get('finding_type')
    const priority = searchParams.get('priority')
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200)
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

    const supabase = createServiceClient()

    let query = supabase
      .from('research_findings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)
    if (findingType) query = query.eq('finding_type', findingType)
    if (priority) query = query.eq('priority', priority)

    const { data: findings, error: dbError, count: total } = await query.range(offset, offset + limit - 1)

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      findings: findings || [],
      total: total || 0,
      limit,
      offset,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * POST /api/research/findings
 * Create a new research finding.
 * Required fields: source, finding_type, summary
 */
export async function POST(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const forbidden = adminGuard(auth.user.id)
    if (forbidden) return forbidden

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createFindingSchema.safeParse(raw)
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

    const { data: finding, error: dbError } = await supabase
      .from('research_findings')
      .insert(parsed.data)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, finding }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/research/findings
 * Update a research finding.
 * Updatable fields: status, priority, recommended_action, engineering_task_id
 */
export async function PATCH(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const forbidden = adminGuard(auth.user.id)
    if (forbidden) return forbidden

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = updateFindingSchema.safeParse(raw)
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

    const { id, ...updates } = parsed.data

    // Only include fields that were actually provided
    const cleanUpdates: Record<string, unknown> = {}
    if (updates.status !== undefined) cleanUpdates.status = updates.status
    if (updates.priority !== undefined) cleanUpdates.priority = updates.priority
    if (updates.recommended_action !== undefined) cleanUpdates.recommended_action = updates.recommended_action
    if (updates.engineering_task_id !== undefined) cleanUpdates.engineering_task_id = updates.engineering_task_id

    if (Object.keys(cleanUpdates).length === 0) {
      return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: finding, error: dbError } = await supabase
      .from('research_findings')
      .update(cleanUpdates)
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, finding })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
