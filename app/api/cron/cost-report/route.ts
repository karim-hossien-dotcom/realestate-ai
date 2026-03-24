import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'

const CRON_SECRET = process.env.CRON_SECRET || ''

// Fixed monthly costs
const FIXED_COSTS = {
  render_node: 7.00,
  render_python: 7.00,
  render_cron: 1.00,
  supabase: 0, // Free tier
  cloudflare: 0, // Free tier
  resend: 0, // Free tier
  stripe: 0, // % based, calculated from revenue
}

/**
 * GET /api/cron/cost-report
 * Monthly cost and revenue report — calculates MRR, message volume,
 * cost breakdown, and margins. Writes to daily_reports for finance dept.
 * Schedule: Monthly on the 1st.
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceClient()
    const today = new Date()
    const reportDate = today.toISOString().split('T')[0]

    // Get the previous month's date range
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    const monthStart = firstOfLastMonth.toISOString()
    const monthEnd = lastOfLastMonth.toISOString()
    const monthLabel = firstOfLastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Count active subscriptions for MRR
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan_id, status')
      .eq('status', 'active')

    const { data: plans } = await supabase
      .from('plans')
      .select('id, name, price, slug')

    const planMap: Record<string, { name: string; price: number; slug: string }> = {}
    for (const plan of plans || []) {
      planMap[plan.id] = { name: plan.name, price: plan.price, slug: plan.slug }
    }

    let mrr = 0
    const subscribersByPlan: Record<string, number> = {}
    for (const sub of subscriptions || []) {
      const plan = planMap[sub.plan_id]
      if (plan) {
        mrr += plan.price
        subscribersByPlan[plan.slug] = (subscribersByPlan[plan.slug] || 0) + 1
      }
    }

    // Count messages sent last month
    const { count: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    // Count usage records (overages) last month
    const { data: overages } = await supabase
      .from('usage_records')
      .select('quantity, amount')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    const totalOverageRevenue = (overages || []).reduce((sum, o) => sum + (o.amount || 0), 0)
    const totalOverageMessages = (overages || []).reduce((sum, o) => sum + (o.quantity || 0), 0)

    // OpenAI cost estimate (based on message volume)
    const estimatedOpenAICost = (messageCount || 0) * 0.003 // ~$0.003 per AI-processed message

    // Calculate totals
    const fixedTotal = Object.values(FIXED_COSTS).reduce((s, v) => s + v, 0)
    const variableCosts = estimatedOpenAICost
    const totalCosts = fixedTotal + variableCosts
    const totalRevenue = mrr + totalOverageRevenue
    const grossMargin = totalRevenue > 0
      ? Math.round(((totalRevenue - totalCosts) / totalRevenue) * 100)
      : 0

    // Determine health status
    const healthStatus = totalRevenue >= totalCosts ? 'green' : totalRevenue > 0 ? 'yellow' : 'red'

    const findings = [
      `${monthLabel}: MRR $${mrr.toFixed(2)}, Overages $${totalOverageRevenue.toFixed(2)}, Total Revenue $${totalRevenue.toFixed(2)}`,
      `Total costs: $${totalCosts.toFixed(2)} (fixed $${fixedTotal.toFixed(2)} + variable $${variableCosts.toFixed(2)})`,
      `Gross margin: ${grossMargin}%`,
      `Messages sent: ${messageCount || 0} (${totalOverageMessages} overage)`,
      `Active subscribers: ${(subscriptions || []).length} (${Object.entries(subscribersByPlan).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'})`,
    ]

    // Write to daily_reports
    const { error: reportError } = await supabase
      .from('daily_reports')
      .upsert({
        department: 'finance',
        report_date: reportDate,
        health_status: healthStatus,
        metrics: {
          month: monthLabel,
          mrr,
          overage_revenue: totalOverageRevenue,
          total_revenue: totalRevenue,
          fixed_costs: fixedTotal,
          variable_costs: variableCosts,
          total_costs: totalCosts,
          gross_margin_pct: grossMargin,
          messages_sent: messageCount || 0,
          overage_messages: totalOverageMessages,
          subscribers: (subscriptions || []).length,
          subscribers_by_plan: subscribersByPlan,
          openai_cost_estimate: estimatedOpenAICost,
        },
        findings,
        actions_taken: [`Monthly cost report generated for ${monthLabel}`],
        actions_proposed: totalRevenue < totalCosts
          ? ['Revenue below costs — review pricing or reduce spend']
          : ['Costs healthy — continue monitoring'],
        blockers: [],
      }, { onConflict: 'department,report_date' })

    if (reportError) {
      console.error('Failed to write cost report:', reportError)
    }

    return NextResponse.json({
      ok: true,
      report_date: reportDate,
      month: monthLabel,
      revenue: { mrr, overages: totalOverageRevenue, total: totalRevenue },
      costs: { fixed: fixedTotal, variable: variableCosts, total: totalCosts },
      gross_margin_pct: grossMargin,
      messages: { sent: messageCount || 0, overage: totalOverageMessages },
      subscribers: { total: (subscriptions || []).length, by_plan: subscribersByPlan },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cost report error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
