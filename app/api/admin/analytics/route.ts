import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

export async function GET(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response
  if (auth.user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '7d'
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createServiceClient()

  // Get all activity logs in period
  const { data: logs } = await supabase
    .from('activity_logs')
    .select('event_type, user_id, status, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  const entries = logs || []

  // Aggregate by event_type
  const featureCounts: Record<string, number> = {}
  const featureUsers: Record<string, Set<string>> = {}
  const dailyCounts: Record<string, number> = {}

  for (const entry of entries) {
    const type = entry.event_type || 'unknown'
    featureCounts[type] = (featureCounts[type] || 0) + 1

    if (!featureUsers[type]) featureUsers[type] = new Set()
    featureUsers[type].add(entry.user_id)

    const day = entry.created_at.split('T')[0]
    dailyCounts[day] = (dailyCounts[day] || 0) + 1
  }

  // Build feature usage array sorted by count
  const features = Object.entries(featureCounts)
    .map(([name, count]) => ({
      name,
      count,
      uniqueUsers: featureUsers[name]?.size || 0,
    }))
    .sort((a, b) => b.count - a.count)

  // Build time series
  const timeSeries = Object.entries(dailyCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Top users by activity
  const userActivityMap: Record<string, number> = {}
  for (const entry of entries) {
    userActivityMap[entry.user_id] = (userActivityMap[entry.user_id] || 0) + 1
  }
  const topUsers = Object.entries(userActivityMap)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return NextResponse.json({
    ok: true,
    period,
    totalEvents: entries.length,
    features,
    timeSeries,
    topUsers,
  })
}
