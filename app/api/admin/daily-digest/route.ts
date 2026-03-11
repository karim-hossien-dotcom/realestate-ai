import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a';

/**
 * GET /api/admin/daily-digest?date=YYYY-MM-DD
 * Aggregates daily_reports for a given date across all 5 departments.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await withAuth();
    if (!auth.ok) return auth.response;
    if (auth.user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const supabase = await createClient();

    // Fetch daily reports for the date
    const { data: reports, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('report_date', date)
      .order('department', { ascending: true });

    if (error) {
      console.error('daily-digest fetch error:', error);
      return NextResponse.json({ ok: false, error: 'Failed to fetch reports' }, { status: 500 });
    }

    const departments = ['market_research', 'finance', 'legal', 'engineering', 'marketing'];
    const reportMap = new Map((reports || []).map(r => [r.department, r]));

    // Aggregate across departments
    const allFindings: string[] = [];
    const allActionsTaken: string[] = [];
    const allActionsProposed: string[] = [];
    const allBlockers: string[] = [];
    const departmentHealth: Record<string, string> = {};

    for (const dept of departments) {
      const r = reportMap.get(dept);
      if (r) {
        departmentHealth[dept] = r.health_status || 'green';
        allFindings.push(...(r.findings || []).map((f: string) => `[${dept}] ${f}`));
        allActionsTaken.push(...(r.actions_taken || []).map((a: string) => `[${dept}] ${a}`));
        allActionsProposed.push(...(r.actions_proposed || []).map((a: string) => `[${dept}] ${a}`));
        allBlockers.push(...(r.blockers || []).map((b: string) => `[${dept}] ${b}`));
      } else {
        departmentHealth[dept] = 'gray'; // no report filed
      }
    }

    // Overall health = worst status
    const healthOrder = { red: 0, yellow: 1, green: 2, gray: 3 };
    const worstHealth = Object.values(departmentHealth).reduce((worst, h) => {
      const key = h as keyof typeof healthOrder;
      const worstKey = worst as keyof typeof healthOrder;
      return (healthOrder[key] ?? 3) < (healthOrder[worstKey] ?? 3) ? h : worst;
    }, 'green');

    // Fetch key metrics from subscriptions + messages for that date
    const metrics: Record<string, string | number> = {};
    try {
      const { count: activeSubs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      metrics.active_subscriptions = activeSubs || 0;

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);
      metrics.messages_today = msgCount || 0;

      const { count: errorCount } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);
      metrics.errors_today = errorCount || 0;

      const { count: leadCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);
      metrics.new_leads_today = leadCount || 0;
    } catch {
      // Metrics are best-effort
    }

    return NextResponse.json({
      ok: true,
      date,
      overall_health: worstHealth,
      department_health: departmentHealth,
      reports_filed: reports?.length || 0,
      reports_missing: departments.length - (reports?.length || 0),
      metrics,
      findings: allFindings,
      actions_taken: allActionsTaken,
      actions_proposed: allActionsProposed,
      blockers: allBlockers,
      raw_reports: reports || [],
    });
  } catch (err) {
    console.error('daily-digest error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
