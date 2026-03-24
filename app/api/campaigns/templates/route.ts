import { NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { CAMPAIGN_TEMPLATES } from '@/app/lib/messaging/campaign-templates'

/**
 * GET /api/campaigns/templates
 * Returns available campaign message templates
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  return NextResponse.json({
    ok: true,
    templates: CAMPAIGN_TEMPLATES,
  })
}
