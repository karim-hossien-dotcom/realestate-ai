import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { sendEmail } from '@/app/lib/messaging/email'

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'karim@eywaconsulting.com'
const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * GET /api/cron/delivery-monitor
 *
 * Checks for messages stuck in "sent" status (no delivery confirmation).
 * WhatsApp should update to "delivered" within minutes. If still "sent"
 * after 30 minutes, something is wrong (bad phone format, not on WhatsApp, etc).
 *
 * Also reports delivery rate stats per user.
 * Run via cron every 30 minutes.
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  try {
    // 1. Find messages stuck in "sent" for 30+ minutes (should be delivered by now)
    const { data: stuckMessages, error: stuckError } = await supabase
      .from('messages')
      .select('id, user_id, to_number, channel, body, created_at, campaign_id')
      .eq('direction', 'outbound')
      .eq('status', 'sent')
      .lt('created_at', thirtyMinAgo)
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(100)

    if (stuckError) {
      return NextResponse.json({ ok: false, error: stuckError.message }, { status: 500 })
    }

    // 2. Mark stuck messages as "unconfirmed" so they don't keep triggering alerts
    const stuckIds = (stuckMessages || []).map(m => m.id)
    if (stuckIds.length > 0) {
      await supabase
        .from('messages')
        .update({ status: 'unconfirmed', error_message: 'No delivery confirmation received after 30 minutes' })
        .in('id', stuckIds)
    }

    // 3. Get delivery stats for last 24h per channel
    const { data: allMessages } = await supabase
      .from('messages')
      .select('status, channel')
      .eq('direction', 'outbound')
      .gt('created_at', twentyFourHoursAgo)

    const stats: Record<string, { total: number; delivered: number; read: number; failed: number; unconfirmed: number; sent: number }> = {}
    for (const m of allMessages || []) {
      const ch = m.channel || 'unknown'
      if (!stats[ch]) stats[ch] = { total: 0, delivered: 0, read: 0, failed: 0, unconfirmed: 0, sent: 0 }
      stats[ch].total++
      if (m.status === 'delivered') stats[ch].delivered++
      else if (m.status === 'read') stats[ch].read++
      else if (m.status === 'failed') stats[ch].failed++
      else if (m.status === 'unconfirmed') stats[ch].unconfirmed++
      else if (m.status === 'sent') stats[ch].sent++
    }

    // 4. Check for bad phone formats (10-digit numbers that should have country code)
    const { data: badPhones } = await supabase
      .from('messages')
      .select('id, to_number')
      .eq('direction', 'outbound')
      .eq('channel', 'whatsapp')
      .in('status', ['unconfirmed', 'failed'])
      .gt('created_at', twentyFourHoursAgo)
      .limit(50)

    const missingCountryCode = (badPhones || []).filter(m => {
      const digits = (m.to_number || '').replace(/[^\d]/g, '')
      return digits.length === 10 // US number without country code
    })

    // 5. Get per-user delivery rates
    const { data: userMessages } = await supabase
      .from('messages')
      .select('user_id, status')
      .eq('direction', 'outbound')
      .gt('created_at', twentyFourHoursAgo)

    const userStats: Record<string, { total: number; confirmed: number }> = {}
    for (const m of userMessages || []) {
      const uid = m.user_id
      if (!uid) continue
      if (!userStats[uid]) userStats[uid] = { total: 0, confirmed: 0 }
      userStats[uid].total++
      if (['delivered', 'read'].includes(m.status)) userStats[uid].confirmed++
    }

    // 6. Alert if delivery rate is low or stuck messages found
    const totalOutbound = Object.values(stats).reduce((s, c) => s + c.total, 0)
    const totalConfirmed = Object.values(stats).reduce((s, c) => s + c.delivered + c.read, 0)
    const deliveryRate = totalOutbound > 0 ? Math.round((totalConfirmed / totalOutbound) * 100) : 100
    const hasIssues = stuckIds.length > 0 || deliveryRate < 50 || missingCountryCode.length > 0

    if (hasIssues && ADMIN_EMAIL) {
      const lines = [
        `Delivery Monitor Alert — ${new Date().toISOString().slice(0, 16)}`,
        '',
        `Messages stuck in "sent" (30+ min): ${stuckIds.length}`,
        `Messages missing country code: ${missingCountryCode.length}`,
        `Delivery rate (24h): ${deliveryRate}%`,
        '',
        'Channel breakdown (24h):',
        ...Object.entries(stats).map(([ch, s]) =>
          `  ${ch}: ${s.total} total, ${s.delivered} delivered, ${s.read} read, ${s.failed} failed, ${s.unconfirmed} unconfirmed`
        ),
      ]

      if (missingCountryCode.length > 0) {
        lines.push('', 'Numbers missing country code (likely never delivered):')
        for (const m of missingCountryCode.slice(0, 10)) {
          lines.push(`  ${m.to_number}`)
        }
      }

      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[Estate AI] Delivery Alert: ${stuckIds.length} stuck, ${deliveryRate}% rate`,
        text: lines.join('\n'),
        html: `<pre style="font-family:monospace;font-size:13px">${lines.join('\n')}</pre>`,
      }).catch(err => console.error('[delivery-monitor] email failed:', err))
    }

    // 7. Log to activity_logs
    await supabase.from('activity_logs').insert({
      user_id: null,
      event_type: 'delivery_monitor',
      description: `Delivery check: ${stuckIds.length} stuck, ${deliveryRate}% rate (24h), ${missingCountryCode.length} bad phones`,
      status: hasIssues ? 'warning' : 'success',
      metadata: { stats, stuckCount: stuckIds.length, deliveryRate, missingCountryCode: missingCountryCode.length },
    })

    return NextResponse.json({
      ok: true,
      stuckMessages: stuckIds.length,
      markedUnconfirmed: stuckIds.length,
      missingCountryCode: missingCountryCode.length,
      deliveryRate,
      stats,
      hasIssues,
    })
  } catch (err) {
    console.error('[delivery-monitor] error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Delivery monitor failed' },
      { status: 500 }
    )
  }
}
