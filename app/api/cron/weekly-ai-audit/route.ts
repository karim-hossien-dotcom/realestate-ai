import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAudit } from '@/app/lib/ai-audit'
import { sendEmail } from '@/app/lib/email'

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
    if (adminEmail && result.audited > 0) {
      await sendEmail({
        to: adminEmail,
        subject: `Weekly AI Audit: ${result.audited} conversations scored (avg ${result.avgScore}/5)`,
        text: `Weekly AI Audit Summary\n\nConversations audited: ${result.audited}\nAverage quality score: ${result.avgScore}/5\n\nView details in the Command Center > Engineering tab.`,
        html: `<h2>Weekly AI Audit Summary</h2>
<p><strong>Conversations audited:</strong> ${result.audited}</p>
<p><strong>Average quality score:</strong> ${result.avgScore}/5</p>
<p>View details in the <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://realestate-ai.app'}/admin">Command Center</a> &gt; Engineering tab.</p>`,
      })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
