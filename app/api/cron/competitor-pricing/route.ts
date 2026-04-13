import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { verifyCronSecret } from '@/app/lib/cron-auth'

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
  { name: 'Structurely', starter: 179, pro: 499, note: 'AI lead qualification + SMS' },
  { name: 'Sierra', starter: 499, pro: 999, note: 'AI concierge + IDX websites' },
]

/**
 * GET /api/cron/competitor-pricing
 * Monthly pricing snapshot — writes to daily_reports AND creates research_findings
 * for the market research team to review in Command Center.
 * Schedule: Monthly on the 1st.
 */
export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const supabase = createServiceClient()
    const today = new Date().toISOString().split('T')[0]

    // Compare positioning
    const cheaperThan = COMPETITOR_PRICING.filter(c => c.starter > ESTATE_AI_PLANS.starter.price)
    const moreExpensiveThan = COMPETITOR_PRICING.filter(c => c.starter < ESTATE_AI_PLANS.starter.price)
    const avgCompStarter = Math.round(COMPETITOR_PRICING.reduce((s, c) => s + c.starter, 0) / COMPETITOR_PRICING.length)
    const avgCompPro = Math.round(COMPETITOR_PRICING.reduce((s, c) => s + c.pro, 0) / COMPETITOR_PRICING.length)

    const findings = [
      `Estate AI Starter ($${ESTATE_AI_PLANS.starter.price}) is cheaper than ${cheaperThan.length}/${COMPETITOR_PRICING.length} competitors at entry level`,
      `Competitors with lower entry: ${moreExpensiveThan.map(c => `${c.name} ($${c.starter})`).join(', ') || 'None'}`,
      `Key differentiator: WhatsApp + AI outreach at Pro tier ($${ESTATE_AI_PLANS.pro.price}) vs average competitor Pro ($${avgCompPro})`,
    ]

    const actions_proposed = [
      'Review competitor feature updates for new threats',
      'Check if any competitor launched WhatsApp integration',
      'Evaluate if pricing adjustments needed based on conversion data',
    ]

    // Write to daily_reports
    await supabase
      .from('daily_reports')
      .upsert({
        department: 'market_research',
        report_date: today,
        health_status: 'green',
        metrics: {
          estate_ai_plans: ESTATE_AI_PLANS,
          competitor_count: COMPETITOR_PRICING.length,
          cheaper_than_count: cheaperThan.length,
          avg_competitor_starter: avgCompStarter,
          avg_competitor_pro: avgCompPro,
        },
        findings,
        actions_taken: ['Monthly competitor pricing snapshot generated'],
        actions_proposed,
        blockers: [],
      }, { onConflict: 'department,report_date' })

    // Generate research_findings for each competitor so the Command Center
    // Research tab has new items to review
    let findingsCreated = 0
    for (const comp of COMPETITOR_PRICING) {
      const priceDiff = comp.starter - ESTATE_AI_PLANS.starter.price
      const priceDirection = priceDiff > 0 ? 'more expensive' : priceDiff < 0 ? 'cheaper' : 'same price'

      await supabase.from('research_findings').insert({
        source: 'competitor_pricing',
        finding_type: 'pricing_change',
        competitor_name: comp.name,
        summary: `${comp.name}: Starter $${comp.starter}/mo, Pro $${comp.pro}/mo (${priceDirection} than Estate AI). ${comp.note}.`,
        details: {
          starter_price: comp.starter,
          pro_price: comp.pro,
          price_diff_starter: priceDiff,
          snapshot_date: today,
        },
        recommended_action: priceDiff < 0
          ? `${comp.name} is $${Math.abs(priceDiff)}/mo cheaper at entry — monitor if they add AI features`
          : `Estate AI is $${priceDiff}/mo cheaper than ${comp.name} — highlight in marketing`,
        priority: Math.abs(priceDiff) > 200 ? 'P1' : 'P2',
        status: 'new',
      })
      findingsCreated++
    }

    return NextResponse.json({
      ok: true,
      report_date: today,
      our_pricing: ESTATE_AI_PLANS,
      competitor_count: COMPETITOR_PRICING.length,
      findings_created: findingsCreated,
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
