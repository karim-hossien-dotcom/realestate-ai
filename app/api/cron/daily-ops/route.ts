import { NextRequest, NextResponse } from 'next/server';
import { runSystemChecks } from '@/app/lib/system-checks';
import { createServiceClient } from '@/app/lib/supabase/server';

const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * GET|POST /api/cron/daily-ops
 * Runs system checks + queries key metrics, writes results to daily_reports table.
 * Called by Render cron job (daily or on-demand via /daily-ops:run).
 * Protected by CRON_SECRET.
 */
async function handler(request: NextRequest) {
  // Auth
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url);
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret');
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    // Run system health checks
    const alerts = await runSystemChecks();
    const critical = alerts.filter(a => a.severity === 'critical');
    const warnings = alerts.filter(a => a.severity === 'warning');

    // Determine engineering health
    const engHealth = critical.length > 0 ? 'red' : warnings.length > 0 ? 'yellow' : 'green';

    // Engineering report
    const engFindings = alerts
      .filter(a => a.severity !== 'ok')
      .map(a => `[${a.severity}] ${a.title}: ${a.message}`);

    await supabase.from('daily_reports').upsert({
      department: 'engineering',
      report_date: today,
      health_status: engHealth,
      metrics: {
        total_checks: alerts.length,
        critical: critical.length,
        warnings: warnings.length,
        ok: alerts.filter(a => a.severity === 'ok').length,
      },
      findings: engFindings,
      actions_taken: ['Ran automated system health checks'],
      actions_proposed: critical.length > 0
        ? critical.map(a => `Fix: ${a.title} — ${a.message}`)
        : [],
      blockers: critical.map(a => `[CRITICAL] ${a.title}`),
    }, { onConflict: 'department,report_date' }).throwOnError();

    // Finance report — query metrics
    let finHealth = 'green';
    const finMetrics: Record<string, number> = {};
    const finFindings: string[] = [];

    try {
      const { count: activeSubs } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      finMetrics.active_subscriptions = activeSubs || 0;

      // Message volume (last 24h)
      const yesterday = new Date(Date.now() - 86400_000).toISOString();
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);
      finMetrics.messages_24h = msgCount || 0;

      // Estimate costs
      finMetrics.estimated_msg_cost = Math.round((msgCount || 0) * 0.03 * 100) / 100;

      if (finMetrics.active_subscriptions === 0) {
        finFindings.push('No active subscriptions — $0 MRR');
        finHealth = 'yellow';
      }
    } catch {
      finFindings.push('Could not query finance metrics');
    }

    await supabase.from('daily_reports').upsert({
      department: 'finance',
      report_date: today,
      health_status: finHealth,
      metrics: finMetrics,
      findings: finFindings,
      actions_taken: ['Queried subscription and message volume metrics'],
      actions_proposed: [],
      blockers: [],
    }, { onConflict: 'department,report_date' }).throwOnError();

    // Legal report — basic compliance check
    const legalFindings: string[] = [];
    let legalHealth = 'green';
    try {
      const { count: dncCount } = await supabase
        .from('dnc_list')
        .select('*', { count: 'exact', head: true });
      legalFindings.push(`DNC list has ${dncCount || 0} entries`);
    } catch {
      legalFindings.push('Could not query DNC list');
      legalHealth = 'yellow';
    }

    await supabase.from('daily_reports').upsert({
      department: 'legal',
      report_date: today,
      health_status: legalHealth,
      metrics: {},
      findings: legalFindings,
      actions_taken: ['Checked DNC list count'],
      actions_proposed: [],
      blockers: [],
    }, { onConflict: 'department,report_date' }).throwOnError();

    // Marketing report
    let mktHealth = 'green';
    const mktMetrics: Record<string, number> = {};
    try {
      const { count: campaignCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      mktMetrics.active_campaigns = campaignCount || 0;
      if ((campaignCount || 0) === 0) mktHealth = 'yellow';
    } catch {
      mktHealth = 'yellow';
    }

    await supabase.from('daily_reports').upsert({
      department: 'marketing',
      report_date: today,
      health_status: mktHealth,
      metrics: mktMetrics,
      findings: [],
      actions_taken: ['Checked active campaign count'],
      actions_proposed: [],
      blockers: [],
    }, { onConflict: 'department,report_date' }).throwOnError();

    // Market Research report
    let mrHealth = 'green';
    const mrMetrics: Record<string, number> = {};
    try {
      const { count: newFindings } = await supabase
        .from('research_findings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      mrMetrics.pending_findings = newFindings || 0;
      if ((newFindings || 0) > 10) mrHealth = 'yellow';
    } catch {
      // best effort
    }

    await supabase.from('daily_reports').upsert({
      department: 'market_research',
      report_date: today,
      health_status: mrHealth,
      metrics: mrMetrics,
      findings: [],
      actions_taken: ['Checked pending research findings'],
      actions_proposed: [],
      blockers: [],
    }, { onConflict: 'department,report_date' }).throwOnError();

    // Auto-create project_tasks for critical/warning findings
    // Only creates tasks that don't already exist (dedup by title + date)
    const adminUserId = process.env.ADMIN_USER_ID || '';
    let tasksCreated = 0;

    if (adminUserId && critical.length > 0) {
      for (const alert of critical) {
        const title = `[CRON] ${alert.title}`;
        // Check if task already exists today
        const { data: existing } = await supabase
          .from('project_tasks')
          .select('id')
          .eq('user_id', adminUserId)
          .eq('title', title)
          .gte('created_at', `${today}T00:00:00`)
          .limit(1);

        if (!existing?.length) {
          await supabase.from('project_tasks').insert({
            user_id: adminUserId,
            department: 'engineering',
            priority: 'P0',
            title,
            description: `Auto-detected by daily-ops cron on ${today}: ${alert.message}`,
            is_blocker: true,
            is_automatable: false,
            status: 'pending',
          });
          tasksCreated++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      date: today,
      departments_reported: 5,
      tasks_created: tasksCreated,
      engineering_health: engHealth,
      finance_health: finHealth,
      legal_health: legalHealth,
      marketing_health: mktHealth,
      market_research_health: mrHealth,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[daily-ops] Error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
