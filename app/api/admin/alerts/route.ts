import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { runSystemChecks } from '@/app/lib/system-checks'

const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a'

/**
 * GET /api/admin/alerts
 * Returns live system health alerts. Admin-only.
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const alerts = await runSystemChecks()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      alerts,
      summary: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        ok: alerts.filter(a => a.severity === 'ok').length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
