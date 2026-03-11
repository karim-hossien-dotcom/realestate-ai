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

  // 8. API response time sampling (5 key routes)
  const routesToSample = [
    '/api/health',
    '/api/tasks?limit=1',
    '/api/admin/alerts',
    '/api/settings/profile',
    '/api/analytics/dashboard',
  ]
  const timings: number[] = []
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || ''

  if (baseUrl) {
    for (const route of routesToSample) {
      try {
        const start = Date.now()
        await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(5000) })
        timings.push(Date.now() - start)
      } catch {
        timings.push(5000) // timeout = 5s
      }
    }

    const sorted = [...timings].sort((a, b) => a - b)
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] || 0

    alerts.push({
      key: 'api_response_time',
      category: 'engineering',
      severity: p95 > 2000 ? 'critical' : p95 > 500 ? 'warning' : 'ok',
      title: 'API Response Time (P95)',
      message: p95 > 2000
        ? `P95 response time ${p95}ms — severely degraded performance.`
        : p95 > 500
          ? `P95 response time ${p95}ms — above target.`
          : `P95 response time ${p95}ms — within target.`,
      metricValue: `${p95}ms`,
      threshold: '<500ms',
    })
  }

  // 9. Python webhook health
  const pythonUrl = process.env.PYTHON_WEBHOOK_URL || 'https://realestate-ai-1.onrender.com'
  try {
    const pyStart = Date.now()
    const pyRes = await fetch(`${pythonUrl}/health`, { signal: AbortSignal.timeout(10000) })
    const pyLatency = Date.now() - pyStart

    if (!pyRes.ok) {
      alerts.push({
        key: 'python_webhook',
        category: 'engineering',
        severity: 'critical',
        title: 'Python Webhook Unhealthy',
        message: `Python service returned HTTP ${pyRes.status}. Check Render logs.`,
        metricValue: `HTTP ${pyRes.status}`,
        threshold: 'HTTP 200',
      })
    } else {
      alerts.push({
        key: 'python_webhook',
        category: 'engineering',
        severity: pyLatency > 5000 ? 'warning' : 'ok',
        title: 'Python Webhook',
        message: pyLatency > 5000
          ? `Python service responded in ${pyLatency}ms — may be cold starting.`
          : `Python service healthy (${pyLatency}ms).`,
        metricValue: `${pyLatency}ms`,
        threshold: '<5000ms',
      })
    }
  } catch {
    alerts.push({
      key: 'python_webhook',
      category: 'engineering',
      severity: 'critical',
      title: 'Python Webhook Unreachable',
      message: 'Could not connect to Python webhook service. It may be down or cold starting.',
      metricValue: 'DOWN',
      threshold: 'Reachable',
    })
  }

  // 10. Message delivery rate per channel
  const channelNames = ['whatsapp', 'sms', 'email'] as const
  for (const channel of channelNames) {
    const { count: channelTotal } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .eq('channel', channel)
      .gte('created_at', monthStart)

    const { count: channelFailed } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .eq('channel', channel)
      .eq('status', 'failed')
      .gte('created_at', monthStart)

    const chTotal = channelTotal || 0
    const chFailed = channelFailed || 0
    const chFailRate = chTotal > 0 ? (chFailed / chTotal) * 100 : 0
    const chLabel = channel.charAt(0).toUpperCase() + channel.slice(1)

    alerts.push({
      key: `channel_delivery_${channel}`,
      category: 'engineering',
      severity: chTotal === 0 ? 'ok' : chFailRate > 15 ? 'critical' : chFailRate > 5 ? 'warning' : 'ok',
      title: `${chLabel} Delivery`,
      message: chTotal === 0
        ? `No ${chLabel} messages sent this month.`
        : `${chTotal} messages, ${chFailRate.toFixed(1)}% failure rate.`,
      metricValue: chTotal === 0 ? 'No data' : `${(100 - chFailRate).toFixed(1)}%`,
      threshold: '>95%',
    })
  }

  // 11. 5xx errors in activity_logs (last 24h)
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: errorCount } = await supabase
    .from('activity_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', last24h)
    .or('action.ilike.%error%,action.ilike.%fail%,action.ilike.%500%')

  const errors = errorCount || 0
  alerts.push({
    key: 'error_count_24h',
    category: 'engineering',
    severity: errors > 20 ? 'critical' : errors > 5 ? 'warning' : 'ok',
    title: 'Errors (24h)',
    message: errors === 0
      ? 'No errors logged in the last 24 hours.'
      : `${errors} error${errors > 1 ? 's' : ''} in the last 24 hours.`,
    metricValue: String(errors),
    threshold: '<5',
  })

  // 12. Codebase health warnings (known large files)
  const knownLargeFiles = [
    { file: 'tools/webhook_app.py', lines: 1076 },
    { file: 'tools/ai_inbound_agent.py', lines: 764 },
    { file: 'app/(app)/admin/page.tsx', lines: 772 },
  ]
  const oversized = knownLargeFiles.filter(f => f.lines > 400)

  alerts.push({
    key: 'codebase_health',
    category: 'engineering',
    severity: oversized.some(f => f.lines > 800) ? 'warning' : 'ok',
    title: 'Codebase Health',
    message: oversized.length > 0
      ? `${oversized.length} files exceed 400 lines: ${oversized.map(f => `${f.file} (${f.lines})`).join(', ')}`
      : 'All files within recommended size limits.',
    metricValue: `${oversized.length} oversized`,
    threshold: '0 files >400 lines',
  })

  return alerts
}
