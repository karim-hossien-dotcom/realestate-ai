import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get message stats (last 30 days)
  const { data: messageStats } = await supabase.rpc('get_message_stats', {
    p_user_id: auth.user.id,
    p_days: 30,
  })

  // Get response rate
  const { data: responseRate } = await supabase.rpc('get_response_rate', {
    p_user_id: auth.user.id,
    p_days: 30,
  })

  // Get lead status distribution
  const { data: leadDistribution } = await supabase.rpc('get_lead_status_distribution', {
    p_user_id: auth.user.id,
  })

  // Get messages time series (last 14 days)
  const { data: timeSeries } = await supabase.rpc('get_messages_time_series', {
    p_user_id: auth.user.id,
    p_days: 14,
  })

  // Get total leads count
  const { count: totalLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  // Get leads by score category
  const { data: scoreCategories } = await supabase
    .from('leads')
    .select('score_category')

  const scoreCounts = {
    Hot: 0,
    Warm: 0,
    Cold: 0,
    Dead: 0,
  }
  for (const lead of scoreCategories || []) {
    const cat = lead.score_category as keyof typeof scoreCounts
    if (cat in scoreCounts) {
      scoreCounts[cat]++
    }
  }

  // Get campaign stats
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('sent_count, failed_count, response_count, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const campaignStats = {
    total: campaigns?.length || 0,
    totalSent: campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0,
    totalFailed: campaigns?.reduce((sum, c) => sum + (c.failed_count || 0), 0) || 0,
    totalResponses: campaigns?.reduce((sum, c) => sum + (c.response_count || 0), 0) || 0,
  }

  // Get DNC list count
  const { count: dncCount } = await supabase
    .from('dnc_list')
    .select('*', { count: 'exact', head: true })

  // Get pending follow-ups count
  const { count: pendingFollowUps } = await supabase
    .from('follow_ups')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())

  const stats = messageStats?.[0] || { total_sent: 0, total_received: 0, total_failed: 0 }

  return NextResponse.json({
    ok: true,
    data: {
      overview: {
        totalLeads: totalLeads || 0,
        messagesSent: stats.total_sent || 0,
        messagesReceived: stats.total_received || 0,
        messagesFailed: stats.total_failed || 0,
        responseRate: responseRate || 0,
        dncCount: dncCount || 0,
        pendingFollowUps: pendingFollowUps || 0,
      },
      leadsByScore: scoreCounts,
      leadsByStatus: leadDistribution || [],
      campaigns: campaignStats,
      timeSeries: timeSeries || [],
    },
  })
}
