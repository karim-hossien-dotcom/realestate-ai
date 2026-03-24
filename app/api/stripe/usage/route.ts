import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'
import { OVERAGE_RATES } from '@/app/lib/billing/overage'

/**
 * GET /api/stripe/usage
 * Returns current billing period usage stats for the authenticated user
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  try {
    const supabase = await createClient()

    // Get subscription info
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('user_id', auth.user.id)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get usage for current billing period
    const periodStart = sub?.current_period_start
      ? new Date(sub.current_period_start).toISOString()
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // Count messages by channel this period
    const { count: smsCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('direction', 'outbound')
      .eq('channel', 'sms')
      .gte('created_at', periodStart)

    const { count: emailCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('direction', 'outbound')
      .eq('channel', 'email')
      .gte('created_at', periodStart)

    const { count: whatsappCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('direction', 'outbound')
      .eq('channel', 'whatsapp')
      .gte('created_at', periodStart)

    const { count: leadCount } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)

    // Total outbound messages across all channels (shared quota pool)
    const totalMessages = (smsCount || 0) + (emailCount || 0) + (whatsappCount || 0)

    // Get overage data for current period
    const { data: usageRecord } = await supabase
      .from('usage_records')
      .select('overage_sms, overage_email, overage_whatsapp, overage_leads, overage_reported')
      .eq('user_id', auth.user.id)
      .eq('period_start', periodStart)
      .limit(1)
      .single()

    const overages = {
      sms: usageRecord?.overage_sms || 0,
      email: usageRecord?.overage_email || 0,
      whatsapp: usageRecord?.overage_whatsapp || 0,
      leads: usageRecord?.overage_leads || 0,
      estimatedCost: 0,
      reported: usageRecord?.overage_reported || false,
    }

    // Calculate estimated overage cost in cents
    overages.estimatedCost =
      overages.sms * OVERAGE_RATES.sms.rate +
      overages.email * OVERAGE_RATES.email.rate +
      overages.whatsapp * OVERAGE_RATES.whatsapp.rate +
      overages.leads * OVERAGE_RATES.leads.rate

    return NextResponse.json({
      ok: true,
      subscription: sub
        ? {
            status: sub.status,
            plan: sub.plans?.name || 'Unknown',
            planSlug: sub.plans?.slug || null,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            trialEnd: sub.trial_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          }
        : null,
      usage: {
        sms: smsCount || 0,
        email: emailCount || 0,
        whatsapp: whatsappCount || 0,
        totalMessages,
        leads: leadCount || 0,
        includedMessages: sub?.plans?.included_sms || 0,
        includedLeads: sub?.plans?.included_leads || 0,
        // Deprecated: use includedMessages (shared pool) instead
        includedSms: sub?.plans?.included_sms || 0,
      },
      overages,
      overageRates: {
        sms: OVERAGE_RATES.sms.rate,
        email: OVERAGE_RATES.email.rate,
        whatsapp: OVERAGE_RATES.whatsapp.rate,
        leads: OVERAGE_RATES.leads.rate,
      },
    })
  } catch (err) {
    console.error('[Stripe Usage] Error:', err)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch usage data' },
      { status: 500 }
    )
  }
}
