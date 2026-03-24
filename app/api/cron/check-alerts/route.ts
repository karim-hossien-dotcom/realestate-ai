import { NextResponse } from 'next/server'
import { runSystemChecks } from '@/app/lib/system-checks'
import { sendEmail } from '@/app/lib/messaging/email'

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'karim@eywaconsulting.com'
const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * GET /api/cron/check-alerts
 * Runs all system health checks. Sends email for critical/warning alerts.
 * Called by Render cron job (every 15 min or hourly).
 * Protected by CRON_SECRET header or query param.
 */
export async function GET(request: Request) {
  // Auth: require CRON_SECRET (skip if not set — allows testing)
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const alerts = await runSystemChecks()
    const critical = alerts.filter(a => a.severity === 'critical')
    const warnings = alerts.filter(a => a.severity === 'warning')

    // Email if there are critical or warning alerts
    if (critical.length > 0 || warnings.length > 0) {
      const alertLines = [...critical, ...warnings].map(a =>
        `[${a.severity.toUpperCase()}] ${a.title}: ${a.message} (${a.metricValue} vs threshold ${a.threshold})`
      ).join('\n')

      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px;">
          <h2 style="color: ${critical.length > 0 ? '#FF4444' : '#FFB800'};">
            Estate AI System Alert${critical.length + warnings.length > 1 ? 's' : ''}
          </h2>
          <p style="color: #666;">${new Date().toLocaleString()}</p>
          ${critical.map(a => `
            <div style="padding: 12px; margin: 8px 0; border-radius: 8px; background: #FFF0F0; border-left: 4px solid #FF4444;">
              <strong style="color: #FF4444;">CRITICAL: ${a.title}</strong>
              <p style="margin: 4px 0 0; color: #333;">${a.message}</p>
              <p style="margin: 2px 0 0; color: #999; font-size: 13px;">Value: ${a.metricValue} | Threshold: ${a.threshold}</p>
            </div>
          `).join('')}
          ${warnings.map(a => `
            <div style="padding: 12px; margin: 8px 0; border-radius: 8px; background: #FFF8E0; border-left: 4px solid #FFB800;">
              <strong style="color: #B8860B;">WARNING: ${a.title}</strong>
              <p style="margin: 4px 0 0; color: #333;">${a.message}</p>
              <p style="margin: 2px 0 0; color: #999; font-size: 13px;">Value: ${a.metricValue} | Threshold: ${a.threshold}</p>
            </div>
          `).join('')}
          <p style="color: #999; font-size: 12px; margin-top: 16px;">
            View all alerts: <a href="https://realestate-ai.app/admin">Command Center</a>
          </p>
        </div>
      `

      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[Estate AI] ${critical.length > 0 ? 'CRITICAL' : 'WARNING'}: ${critical.length + warnings.length} alert${critical.length + warnings.length > 1 ? 's' : ''} detected`,
        html,
        text: alertLines,
      }).catch(err => {
        console.error('[check-alerts] Email send failed:', err)
      })
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      total: alerts.length,
      critical: critical.length,
      warnings: warnings.length,
      ok_count: alerts.filter(a => a.severity === 'ok').length,
      alerts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[check-alerts] Error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
