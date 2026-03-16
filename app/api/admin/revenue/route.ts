import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'
import { logActivity } from '@/app/lib/auth'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

// Plan prices in dollars (monthly)
const PLAN_PRICES: Record<string, number> = {
  starter: 99,
  pro: 249,
  agency: 499,
}

interface RevenueDataPoint {
  name: string
  rev: number
  cost: number
}

/**
 * GET /api/admin/revenue
 * Returns monthly revenue data based on active subscriptions.
 * Shows the last 12 months of MRR calculated from the subscriptions table.
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  try {
    const supabase = createServiceClient()

    // Fetch all subscriptions with their plan info
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('status, current_period_start, current_period_end, created_at, plans(slug, name, price)')
      .in('status', ['active', 'trialing', 'canceled', 'past_due'])

    if (subError) {
      console.error('[Admin Revenue] Subscriptions query error:', subError)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    const subs = subscriptions || []

    // Build last 12 months labels
    const now = new Date()
    const months: { year: number; month: number; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleString('en-US', { month: 'short' })
      months.push({ year: d.getFullYear(), month: d.getMonth(), label })
    }

    // For each month, calculate MRR from subscriptions that were active during that month
    const revenueData: RevenueDataPoint[] = months.map(({ year, month, label }) => {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59) // last day of month

      let monthlyRevenue = 0

      for (const sub of subs) {
        // A subscription contributes to a month's MRR if:
        // 1. It was created before the end of that month
        // 2. Its status was active/trialing (or it hadn't been canceled yet)
        const createdAt = new Date(sub.created_at)
        if (createdAt > monthEnd) continue

        // If subscription has a period end that's before the month started,
        // it was already expired/canceled
        if (sub.current_period_end) {
          const periodEnd = new Date(sub.current_period_end)
          if (periodEnd < monthStart && sub.status === 'canceled') continue
        }

        // For canceled subs, check if they were canceled before this month
        if (sub.status === 'canceled' && sub.current_period_end) {
          const periodEnd = new Date(sub.current_period_end)
          if (periodEnd < monthStart) continue
        }

        // Get plan price
        const plan = (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) as { slug: string; name: string; price: number } | null
        const slug = plan?.slug || ''
        // price in DB is in cents, PLAN_PRICES is in dollars
        const priceInDollars = PLAN_PRICES[slug] || (plan?.price ? plan.price / 100 : 0)

        monthlyRevenue += priceInDollars
      }

      // Estimated monthly costs (infrastructure)
      // Render free tier ~$0, paid ~$7-25/service
      // Supabase free tier ~$0, Pro ~$25
      // Rough estimate based on known costs
      const baseCost = 14 // Render baseline
      const perSubCost = 2 // API/messaging costs per subscriber (rough)
      const activeCount = subs.filter(s => {
        const createdAt = new Date(s.created_at)
        if (createdAt > monthEnd) return false
        if (s.status === 'canceled' && s.current_period_end) {
          const periodEnd = new Date(s.current_period_end)
          if (periodEnd < monthStart) return false
        }
        return true
      }).length
      const cost = baseCost + (activeCount * perSubCost)

      return {
        name: label,
        rev: monthlyRevenue,
        cost,
      }
    })

    // Calculate current MRR (active + trialing subs right now)
    const activeSubs = subs.filter(s =>
      s.status === 'active' || s.status === 'trialing'
    )
    const currentMrr = activeSubs.reduce((sum, sub) => {
      const plan = (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) as { slug: string; name: string; price: number } | null
      const slug = plan?.slug || ''
      const priceInDollars = PLAN_PRICES[slug] || (plan?.price ? plan.price / 100 : 0)
      return sum + priceInDollars
    }, 0)

    // Subscriber counts by plan
    const planCounts: Record<string, number> = {}
    for (const sub of activeSubs) {
      const plan = (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans) as { slug: string; name: string; price: number } | null
      const slug = plan?.slug || 'unknown'
      planCounts[slug] = (planCounts[slug] || 0) + 1
    }

    return NextResponse.json({
      ok: true,
      revenueData,
      currentMrr,
      activeSubscribers: activeSubs.length,
      planCounts,
    })
  } catch (err) {
    console.error('[Admin Revenue] Error:', err)
    await logActivity(
      auth.user.id,
      'admin_revenue_error',
      `Failed to fetch revenue data: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'failed'
    ).catch(() => {})
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch revenue data' },
      { status: 500 }
    )
  }
}
