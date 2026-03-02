import { NextResponse } from 'next/server'
import { PLANS } from '@/app/lib/stripe'

/**
 * GET /api/stripe/plans
 * Returns available subscription plans
 */
export async function GET() {
  return NextResponse.json({ ok: true, plans: PLANS })
}
