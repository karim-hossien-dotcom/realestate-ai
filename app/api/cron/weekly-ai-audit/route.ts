import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAudit } from '@/app/lib/ai-audit'
import { sendEmail } from '@/app/lib/messaging/email'

export async function GET(request: NextRequest) {
  // Protect with CRON_SECRET
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret') || request.headers.get('x-cron-secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyAudit()

    // Email admin summary
    const adminEmail = process.env.ADMIN_ALERT_EMAIL
    if (adminEmail && (result.audited > 0 || result.ops)) {
      const ops = result.ops
      const opsSection = ops ? `
Ops Health:
- Messages: ${ops.totalMessages} (${ops.inbound} in / ${ops.outbound} out)
- Unique leads: ${ops.uniqueLeads}
- Avg response time: ${ops.avgResponseTimeSec}s
- Double replies: ${ops.doubleReplies}
- Duplicate sends: ${ops.duplicateSends}
- Name repetition: ${ops.nameRepetition}
- Vague closers: ${ops.vagueClosers}
- Unsubscribe msgs: ${ops.falseUnsubscribes}` : ''

      const opsHtml = ops ? `
<h3>Ops Health</h3>
<table style="border-collapse:collapse;font-size:13px;">
<tr><td style="padding:4px 12px 4px 0;color:#666;">Messages</td><td><strong>${ops.totalMessages}</strong> (${ops.inbound} in / ${ops.outbound} out)</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Unique leads</td><td><strong>${ops.uniqueLeads}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Avg response</td><td><strong>${ops.avgResponseTimeSec}s</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Double replies</td><td style="color:${ops.doubleReplies > 0 ? '#e53e3e' : '#38a169'};"><strong>${ops.doubleReplies}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Duplicate sends</td><td style="color:${ops.duplicateSends > 0 ? '#e53e3e' : '#38a169'};"><strong>${ops.duplicateSends}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Name repetition</td><td>${ops.nameRepetition}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Vague closers</td><td>${ops.vagueClosers}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#666;">Unsubscribe msgs</td><td style="color:${ops.falseUnsubscribes > 0 ? '#e53e3e' : '#38a169'};"><strong>${ops.falseUnsubscribes}</strong></td></tr>
</table>` : ''

      await sendEmail({
        to: adminEmail,
        subject: `Weekly AI Audit: ${result.audited} convos scored (avg ${result.avgScore}/5)${ops && ops.doubleReplies > 10 ? ' ⚠️ Ops issues' : ''}`,
        text: `Weekly AI Audit Summary\n\nConversations audited: ${result.audited}\nAverage quality score: ${result.avgScore}/5\n${opsSection}\n\nView details in the Command Center > Engineering tab.`,
        html: `<h2>Weekly AI Audit Summary</h2>
<p><strong>Conversations audited:</strong> ${result.audited}</p>
<p><strong>Average quality score:</strong> ${result.avgScore}/5</p>
${opsHtml}
<p style="margin-top:16px;"><a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://realestate-ai.app'}/admin">View Command Center</a></p>`,
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
