import { NextResponse } from 'next/server'

const CRON_SECRET = process.env.CRON_SECRET || ''

/**
 * Verify cron secret from request headers.
 * Accepts: Authorization: Bearer <secret>, x-cron-secret: <secret>
 * Returns null if authorized, or an error NextResponse if not.
 * Skips check if CRON_SECRET is not configured.
 */
export function verifyCronSecret(request: Request): NextResponse | null {
  if (!CRON_SECRET) return null

  const authHeader = request.headers.get('authorization') || ''
  const cronHeader = request.headers.get('x-cron-secret') || ''

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cronHeader

  if (token !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
