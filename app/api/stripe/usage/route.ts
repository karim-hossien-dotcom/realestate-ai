import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createClient } from '@/app/lib/supabase/server'

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
        leads: leadCount || 0,
        includedSms: sub?.plans?.included_sms || 0,
        includedLeads: sub?.plans?.included_leads || 0,
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
