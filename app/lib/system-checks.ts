import { createServiceClient } from '@/app/lib/supabase/server'

export interface SystemAlert {
  key: string
  category: 'engineering' | 'finance' | 'legal'
  severity: 'ok' | 'warning' | 'critical'
  title: string
  message: string
  metricValue: string
  threshold: string
}

/**
 * Run all system health checks and return alerts.
 * Used by both the cron endpoint (email notifications) and the admin API (live dashboard).
 */
export async function runSystemChecks(): Promise<SystemAlert[]> {
  const supabase = createServiceClient()
  const alerts: SystemAlert[] = []

  // 1. Database latency
  const dbStart = Date.now()
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    const latency = Date.now() - dbStart

    if (error) {
      alerts.push({
        key: 'db_connectivity',
        category: 'engineering',
        severity: 'critical',
        title: 'Database Unreachable',
        message: `Supabase query failed: ${error.message}`,
        metricValue: 'DOWN',
        threshold: 'Connected',
      })
    } else if (latency > 1000) {
      alerts.push({
        key: 'db_latency',
        category: 'engineering',
        severity: 'critical',
        title: 'Database Latency Critical',
        message: `Query took ${latency}ms — investigate Supabase performance.`,
        metricValue: `${latency}ms`,
        threshold: '<1000ms',
      })
    } else if (latency > 500) {
      alerts.push({
        key: 'db_latency',
        category: 'engineering',
        severity: 'warning',
        title: 'Database Latency High',
        message: `Query took ${latency}ms — monitor closely.`,
        metricValue: `${latency}ms`,
        threshold: '<500ms',
      })
    } else {
      alerts.push({
        key: 'db_latency',
        category: 'engineering',
        severity: 'ok',
        title: 'Database Latency',
        message: `Query responded in ${latency}ms.`,
        metricValue: `${latency}ms`,
        threshold: '<500ms',
      })
    }
  } catch {
    alerts.push({
      key: 'db_connectivity',
      category: 'engineering',
      severity: 'critical',
      title: 'Database Connection Failed',
      message: 'Could not connect to Supabase.',
      metricValue: 'DOWN',
      threshold: 'Connected',
    })
  }

  // 2. Total leads across all users (approaching free tier DB limits)
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  const leadCount = totalLeads || 0
  if (leadCount > 8000) {
    alerts.push({
      key: 'total_leads',
      category: 'engineering',
      severity: 'critical',
      title: 'Lead Volume Critical',
      message: `${leadCount.toLocaleString()} total leads — approaching Supabase free tier row limits. Upgrade DB plan.`,
      metricValue: leadCount.toLocaleString(),
      threshold: '<8,000',
    })
  } else if (leadCount > 5000) {
    alerts.push({
      key: 'total_leads',
      category: 'engineering',
      severity: 'warning',
      title: 'Lead Volume Growing',
      message: `${leadCount.toLocaleString()} total leads — monitor DB size.`,
      metricValue: leadCount.toLocaleString(),
      threshold: '<5,000',
    })
  } else {
    alerts.push({
      key: 'total_leads',
      category: 'engineering',
      severity: 'ok',
      title: 'Lead Volume',
      message: `${leadCount.toLocaleString()} total leads.`,
      metricValue: leadCount.toLocaleString(),
      threshold: '<5,000',
    })
  }

  // 3. Messages this month — volume + failure rate
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { count: totalMsgs } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .gte('created_at', monthStart)

  const { count: failedMsgs } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .eq('status', 'failed')
    .gte('created_at', monthStart)

  const msgCount = totalMsgs || 0
  const failCount = failedMsgs || 0
  const failRate = msgCount > 0 ? (failCount / msgCount) * 100 : 0

  if (failRate > 20) {
    alerts.push({
      key: 'msg_failure_rate',
      category: 'engineering',
      severity: 'critical',
      title: 'Message Failure Rate Critical',
      message: `${failRate.toFixed(1)}% of outbound messages failing (${failCount}/${msgCount}). Check Twilio/WhatsApp/Resend.`,
      metricValue: `${failRate.toFixed(1)}%`,
      threshold: '<10%',
    })
  } else if (failRate > 10) {
    alerts.push({
      key: 'msg_failure_rate',
      category: 'engineering',
      severity: 'warning',
      title: 'Message Failure Rate Elevated',
      message: `${failRate.toFixed(1)}% failure rate (${failCount}/${msgCount}).`,
      metricValue: `${failRate.toFixed(1)}%`,
      threshold: '<10%',
    })
  } else {
    alerts.push({
      key: 'msg_failure_rate',
      category: 'engineering',
      severity: 'ok',
      title: 'Message Delivery',
      message: `${msgCount.toLocaleString()} messages this month, ${failRate.toFixed(1)}% failure rate.`,
      metricValue: `${failRate.toFixed(1)}%`,
      threshold: '<10%',
    })
  }

  // 4. Active subscriptions (revenue health)
  const { count: activeSubs } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .in('status', ['active', 'trialing'])

  const subCount = activeSubs || 0
  alerts.push({
    key: 'active_subs',
    category: 'finance',
    severity: subCount === 0 ? 'warning' : 'ok',
    title: 'Active Subscriptions',
    message: subCount === 0
      ? 'No active subscriptions — pre-revenue.'
      : `${subCount} active subscription${subCount > 1 ? 's' : ''}.`,
    metricValue: String(subCount),
    threshold: '>0',
  })

  // 5. Total registered users
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  alerts.push({
    key: 'total_users',
    category: 'engineering',
    severity: 'ok',
    title: 'Registered Users',
    message: `${userCount || 0} total users.`,
    metricValue: String(userCount || 0),
    threshold: 'n/a',
  })

  // 6. Missing env vars
  const criticalVars = [
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',
  ]
  const missingVars = criticalVars.filter(k => !process.env[k])

  if (missingVars.length > 0) {
    alerts.push({
      key: 'env_vars',
      category: 'engineering',
      severity: 'critical',
      title: 'Missing Environment Variables',
      message: `Missing: ${missingVars.join(', ')}`,
      metricValue: `${missingVars.length} missing`,
      threshold: '0 missing',
    })
  } else {
    alerts.push({
      key: 'env_vars',
      category: 'engineering',
      severity: 'ok',
      title: 'Environment Config',
      message: 'All critical env vars present.',
      metricValue: '0 missing',
      threshold: '0 missing',
    })
  }

  // 7. Messaging channels configured
  const channels = {
    WhatsApp: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    Twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
    Resend: !!process.env.RESEND_API_KEY,
  }
  const downChannels = Object.entries(channels).filter(([, v]) => !v).map(([k]) => k)

  if (downChannels.length > 0) {
    alerts.push({
      key: 'channels',
      category: 'engineering',
      severity: 'warning',
      title: 'Messaging Channels',
      message: `Unconfigured: ${downChannels.join(', ')}. Messages on these channels will fail.`,
      metricValue: `${3 - downChannels.length}/3 active`,
      threshold: '3/3 active',
    })
  } else {
    alerts.push({
      key: 'channels',
      category: 'engineering',
      severity: 'ok',
      title: 'Messaging Channels',
      message: 'WhatsApp, Twilio SMS, and Resend email all configured.',
      metricValue: '3/3 active',
      threshold: '3/3 active',
    })
  }

  return alerts
}
