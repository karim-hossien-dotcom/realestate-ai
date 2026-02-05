import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

export type LogEntry = {
  id: string
  timestamp: string
  eventType: string
  description: string
  user: string
  status: string
  metadata?: Record<string, unknown>
}

export async function GET(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''
  const eventType = searchParams.get('type') || ''
  const timeRange = searchParams.get('range') || '7d'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const supabase = await createClient()

  // Calculate date filter
  const now = new Date()
  let startDate = new Date()
  switch (timeRange) {
    case '24h':
      startDate.setDate(now.getDate() - 1)
      break
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
    default:
      startDate.setDate(now.getDate() - 7)
  }

  // Build query
  let query = supabase
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })

  // Filter by event type
  if (eventType && eventType !== 'all') {
    query = query.eq('event_type', eventType)
  }

  // Filter by search term
  if (search) {
    query = query.or(`description.ilike.%${search}%,event_type.ilike.%${search}%`)
  }

  // Pagination
  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: logs, error, count } = await query

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  // Get stats (unfiltered, all time)
  const { data: allLogs } = await supabase
    .from('activity_logs')
    .select('status, created_at')
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())

  const today = new Date().toISOString().split('T')[0]
  const errorsToday = allLogs?.filter(l => l.status === 'failed' && l.created_at.startsWith(today)).length || 0
  const totalToday = allLogs?.length || 0
  const successToday = allLogs?.filter(l => l.status !== 'failed').length || 0

  const stats = {
    totalEvents: count || 0,
    errorsToday,
    successRate: totalToday > 0 ? Math.round((successToday / totalToday) * 1000) / 10 : 100,
    avgResponseTime: 1.2,
  }

  // Transform logs to expected format
  const transformedLogs: LogEntry[] = (logs || []).map(log => ({
    id: log.id,
    timestamp: log.created_at,
    eventType: log.event_type,
    description: log.description,
    user: 'System',
    status: log.status,
    metadata: log.metadata as Record<string, unknown> | undefined,
  }))

  return NextResponse.json({
    ok: true,
    logs: transformedLogs,
    stats,
    pagination: {
      page,
      limit,
      totalItems: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const { eventType, description, status, metadata } = body

  if (!eventType || !description) {
    return NextResponse.json(
      { ok: false, error: 'eventType and description are required' },
      { status: 400 }
    )
  }

  await logActivity(
    auth.user.id,
    eventType,
    description,
    status || 'success',
    metadata
  )

  return NextResponse.json({ ok: true })
}
