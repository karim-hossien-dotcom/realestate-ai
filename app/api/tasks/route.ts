import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { parseBody } from '@/app/lib/api'
import { createProjectTaskSchema, updateProjectTaskSchema, batchUpdateTasksSchema } from '@/app/lib/schemas'
import { createClient } from '@/app/lib/supabase/server'

// GET /api/tasks — list tasks with filters
export async function GET(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const blockers = searchParams.get('blockers') === 'true'
    const automatable = searchParams.get('automatable') === 'true'
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 200)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = await createClient()

    let query = supabase
      .from('project_tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', auth.user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (department) query = query.eq('department', department)
    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)
    if (blockers) query = query.eq('is_blocker', true)
    if (automatable) query = query.eq('is_automatable', true)

    const { data: tasks, error: dbError, count: total } = await query.range(from, to)

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    // Compute summary stats
    const allQuery = supabase
      .from('project_tasks')
      .select('department, status, priority, is_blocker, is_automatable')
      .eq('user_id', auth.user.id)

    const { data: allTasks } = await allQuery

    const all = allTasks || []
    const open = all.filter(t => t.status !== 'completed')
    const summary = {
      total: all.length,
      completed: all.filter(t => t.status === 'completed').length,
      blockers: all.filter(t => t.is_blocker && t.status !== 'completed').length,
      automatable: open.filter(t => t.is_automatable).length,
      byDepartment: {
        legal: all.filter(t => t.department === 'legal').length,
        engineering: all.filter(t => t.department === 'engineering').length,
        marketing: all.filter(t => t.department === 'marketing').length,
        finance: all.filter(t => t.department === 'finance').length,
        market_research: all.filter(t => t.department === 'market_research').length,
      },
    }

    return NextResponse.json({
      ok: true,
      tasks: tasks || [],
      summary,
      total: total || 0,
      page,
      limit,
      totalPages: Math.ceil((total || 0) / limit),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// POST /api/tasks — create a task (or batch create)
export async function POST(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const body = await request.json()

    // Support batch create: { tasks: [...] }
    if (Array.isArray(body.tasks)) {
      const validated = body.tasks.map((t: unknown) => createProjectTaskSchema.parse(t))
      const withUser = validated.map((t: Record<string, unknown>) => ({
        ...t,
        user_id: auth.user.id,
      }))

      const supabase = await createClient()
      const { data: tasks, error: dbError } = await supabase
        .from('project_tasks')
        .insert(withUser)
        .select()

      if (dbError) {
        return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
      }

      await logActivity(auth.user.id, 'tasks.batch_create', `Created ${tasks?.length || 0} project tasks`)

      return NextResponse.json({ ok: true, tasks, created: tasks?.length || 0 }, { status: 201 })
    }

    // Single create
    const parsed = await parseBody(new Request(request.url, { method: 'POST', body: JSON.stringify(body) }), createProjectTaskSchema)
    if (!parsed.ok) return parsed.response

    const supabase = await createClient()
    const { data: task, error: dbError } = await supabase
      .from('project_tasks')
      .insert({ user_id: auth.user.id, ...parsed.data })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    await logActivity(auth.user.id, 'tasks.create', `Created task: ${task.title}`)

    return NextResponse.json({ ok: true, task }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// PATCH /api/tasks — update a single task or batch update
export async function PATCH(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const body = await request.json()

    // Batch update: { ids: [...], status: "completed" }
    if (Array.isArray(body.ids)) {
      const parsed = batchUpdateTasksSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({
          ok: false,
          error: 'Validation failed',
          details: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
        }, { status: 400 })
      }

      const updates: Record<string, unknown> = {
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      }

      if (parsed.data.status === 'completed') {
        updates.completed_at = new Date().toISOString()
        updates.completed_by = parsed.data.completed_by || 'user'
        if (parsed.data.completion_note) updates.completion_note = parsed.data.completion_note
      }

      const supabase = await createClient()
      const { error: dbError } = await supabase
        .from('project_tasks')
        .update(updates)
        .in('id', parsed.data.ids)
        .eq('user_id', auth.user.id)

      if (dbError) {
        return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
      }

      await logActivity(
        auth.user.id,
        'tasks.batch_update',
        `Updated ${parsed.data.ids.length} tasks to ${parsed.data.status}`,
        'success',
        { ids: parsed.data.ids, completed_by: parsed.data.completed_by }
      )

      return NextResponse.json({ ok: true, updated: parsed.data.ids.length })
    }

    // Single update
    const parsed = updateProjectTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({
        ok: false,
        error: 'Validation failed',
        details: parsed.error.issues.map(e => ({ field: e.path.join('.'), message: e.message })),
      }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // Auto-fill completion fields
    if (updates.status === 'completed') {
      (updates as Record<string, unknown>).completed_at = new Date().toISOString()
      if (!updates.completed_by) updates.completed_by = 'user'
    }

    const supabase = await createClient()
    const { data: task, error: dbError } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.user.id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    await logActivity(
      auth.user.id,
      'tasks.update',
      `Updated task: ${task.title} → ${updates.status || 'modified'}`,
      'success',
      { task_id: id, updates }
    )

    return NextResponse.json({ ok: true, task })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// DELETE /api/tasks?id=xxx or { ids: [...] }
export async function DELETE(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    const supabase = await createClient()

    if (!id) {
      const body = await request.json()
      const ids = body?.ids as string[] | undefined
      if (!ids || ids.length === 0) {
        return NextResponse.json({ ok: false, error: 'Task ID or ids[] required' }, { status: 400 })
      }

      const { error: dbError } = await supabase
        .from('project_tasks')
        .delete()
        .in('id', ids)
        .eq('user_id', auth.user.id)

      if (dbError) {
        return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, deleted: ids.length })
    }

    const { error: dbError } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id)

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
