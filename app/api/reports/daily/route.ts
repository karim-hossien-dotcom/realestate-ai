import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a'

const VALID_DEPARTMENTS = ['market_research', 'engineering', 'marketing', 'legal', 'finance'] as const

type Department = typeof VALID_DEPARTMENTS[number]
type HealthStatus = 'green' | 'yellow' | 'red'

interface DailyReport {
  id: string
  department: Department
  report_date: string
  health_status: HealthStatus
  metrics: Record<string, unknown>
  findings: string[]
  actions_taken: string[]
  actions_proposed: string[]
  blockers: string[]
  created_at: string
  updated_at: string
}

interface DepartmentGroup {
  department: Department
  health_status: HealthStatus
  report: DailyReport | null
}

/**
 * GET /api/reports/daily
 * Fetch daily reports with optional date and department filters.
 * Query params: date (YYYY-MM-DD, defaults to today), department
 * Returns reports grouped by department with health indicators.
 */
export async function GET(request: Request) {
  try {
    const auth = await withAuth()
    if (!auth.ok) return auth.response

    if (auth.user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const departmentParam = searchParams.get('department')

    // Default to today's date in UTC
    const reportDate = dateParam || new Date().toISOString().split('T')[0]

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }

    // Validate department if provided
    if (departmentParam && !VALID_DEPARTMENTS.includes(departmentParam as Department)) {
      return NextResponse.json(
        { ok: false, error: `Invalid department. Valid values: ${VALID_DEPARTMENTS.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    let query = supabase
      .from('daily_reports')
      .select('*')
      .eq('report_date', reportDate)
      .order('department', { ascending: true })

    if (departmentParam) {
      query = query.eq('department', departmentParam)
    }

    const { data: reports, error: dbError } = await query

    if (dbError) {
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 })
    }

    const fetchedReports = (reports || []) as DailyReport[]

    // Build a map of fetched reports keyed by department
    const reportMap = new Map<string, DailyReport>()
    for (const report of fetchedReports) {
      reportMap.set(report.department, report)
    }

    // Group by department -- include all departments even if no report exists
    const departments: Department[] = departmentParam
      ? [departmentParam as Department]
      : [...VALID_DEPARTMENTS]

    const grouped: DepartmentGroup[] = departments.map(dept => {
      const report = reportMap.get(dept) || null
      return {
        department: dept,
        health_status: report?.health_status || 'green',
        report,
      }
    })

    // Compute overall health: worst status across all departments
    const healthValues: Record<HealthStatus, number> = { green: 0, yellow: 1, red: 2 }
    const worstHealth = grouped.reduce<HealthStatus>((worst, g) => {
      return healthValues[g.health_status] > healthValues[worst] ? g.health_status : worst
    }, 'green')

    return NextResponse.json({
      ok: true,
      date: reportDate,
      overall_health: worstHealth,
      departments: grouped,
      reports_filed: fetchedReports.length,
      reports_missing: departments.length - fetchedReports.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
