import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'

const CRON_SECRET = process.env.CRON_SECRET || ''

// Current Estate AI pricing for snapshot comparison
const ESTATE_AI_PLANS = {
  starter: { price: 99, messages: 500, channels: ['sms', 'email'] },
  pro: { price: 249, messages: 2000, channels: ['sms', 'email', 'whatsapp'] },
  agency: { price: 499, messages: 5000, channels: ['sms', 'email', 'whatsapp'] },
}

// Known competitor pricing (updated manually or via research)
const COMPETITOR_PRICING = [
  { name: 'Follow Up Boss', starter: 69, pro: 499, note: 'CRM only, no AI outreach' },
  { name: 'CallSine', starter: 149, pro: 499, note: 'AI calling + SMS' },
  { name: 'Ylopo', starter: 295, pro: 795, note: 'Lead gen + AI nurture' },
  { name: 'Lofty (Chime)', starter: 449, pro: 899, note: 'Full platform + IDX' },
  { name: 'kvCORE', starter: 499, pro: 1200, note: 'Enterprise CRM + marketing' },
  { name: 'LionDesk', starter: 25, pro: 83, note: 'Basic CRM + drip campaigns' },
]

/**
 * GET /api/cron/competitor-pricing
 * Monthly pricing snapshot — logs current plans and competitor comparison
 * to daily_reports for market_research department.
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
    const today = new Date().toISOString().split('T')[0]

    // Compare positioning
    const cheaperThan = COMPETITOR_PRICING.filter(c => c.starter > ESTATE_AI_PLANS.starter.price)
    const moreExpensiveThan = COMPETITOR_PRICING.filter(c => c.starter < ESTATE_AI_PLANS.starter.price)

    const findings = [
      `Estate AI Starter ($${ESTATE_AI_PLANS.starter.price}) is cheaper than ${cheaperThan.length}/${COMPETITOR_PRICING.length} competitors at entry level`,
      `Competitors with lower entry: ${moreExpensiveThan.map(c => `${c.name} ($${c.starter})`).join(', ') || 'None'}`,
      `Key differentiator: WhatsApp + AI outreach at Pro tier ($${ESTATE_AI_PLANS.pro.price}) vs average competitor Pro ($${Math.round(COMPETITOR_PRICING.reduce((s, c) => s + c.pro, 0) / COMPETITOR_PRICING.length)})`,
    ]

    const actions_proposed = [
      'Review competitor feature updates for new threats',
      'Check if any competitor launched WhatsApp integration',
      'Evaluate if pricing adjustments needed based on conversion data',
    ]

    // Write to daily_reports
    const { error: reportError } = await supabase
      .from('daily_reports')
      .upsert({
        department: 'market_research',
        report_date: today,
        health_status: 'green',
        metrics: {
          estate_ai_plans: ESTATE_AI_PLANS,
          competitor_count: COMPETITOR_PRICING.length,
          cheaper_than_count: cheaperThan.length,
          avg_competitor_starter: Math.round(COMPETITOR_PRICING.reduce((s, c) => s + c.starter, 0) / COMPETITOR_PRICING.length),
          avg_competitor_pro: Math.round(COMPETITOR_PRICING.reduce((s, c) => s + c.pro, 0) / COMPETITOR_PRICING.length),
        },
        findings,
        actions_taken: ['Monthly competitor pricing snapshot generated'],
        actions_proposed,
        blockers: [],
      }, { onConflict: 'department,report_date' })

    if (reportError) {
      console.error('Failed to write competitor pricing report:', reportError)
    }

    return NextResponse.json({
      ok: true,
      report_date: today,
      our_pricing: ESTATE_AI_PLANS,
      competitor_count: COMPETITOR_PRICING.length,
      position: {
        cheaper_than: cheaperThan.map(c => c.name),
        more_expensive_than: moreExpensiveThan.map(c => c.name),
      },
      findings,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Competitor pricing report error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
