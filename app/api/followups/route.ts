import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

type FollowUpItem = {
  id: string
  leadId: string
  phone: string | null
  email: string | null
  ownerName: string
  propertyAddress: string
  daysSinceContact: number
  lastSent: string
  lastResponse?: string
  responseStatus: 'no_response' | 'replied' | 'needs_followup' | 'not_interested' | 'interested'
  suggestedAction: string
  originalMessage: string
}

type ScheduledFollowUp = {
  id: string
  leadId: string
  leadName: string
  phone: string | null
  messageText: string
  scheduledAt: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'
  sentAt: string | null
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date2.getTime() - date1.getTime())
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const now = new Date()

  // Get all leads that have been contacted
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, owner_name, property_address, phone, email, status, last_contacted, last_response')
    .eq('user_id', auth.user.id)
    .not('last_contacted', 'is', null)
    .order('last_contacted', { ascending: false })

  if (leadsError) {
    await logActivity(auth.user.id, 'followup.view', `Failed to fetch follow-ups: ${leadsError.message}`, 'failed')
    return NextResponse.json({ ok: false, error: leadsError.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      ok: true,
      followups: [],
      scheduled: [],
      stats: { total: 0, no_response: 0, needs_followup: 0, replied: 0, interested: 0, not_interested: 0 },
      message: 'No campaigns sent yet. Send campaigns first from the Campaigns page.',
    })
  }

  // Get latest messages for each lead
  const { data: messages } = await supabase
    .from('messages')
    .select('lead_id, direction, body, created_at, status')
    .eq('user_id', auth.user.id)
    .in('lead_id', leads.map(l => l.id))
    .order('created_at', { ascending: false })

  // Group messages by lead
  const messagesByLead = new Map<string, typeof messages>()
  for (const msg of messages || []) {
    if (!msg.lead_id) continue
    if (!messagesByLead.has(msg.lead_id)) messagesByLead.set(msg.lead_id, [])
    messagesByLead.get(msg.lead_id)!.push(msg)
  }

  // Get scheduled follow-ups for all user's leads
  const { data: scheduledRows } = await supabase
    .from('follow_ups')
    .select('id, lead_id, message_text, scheduled_at, status, sent_at')
    .eq('user_id', auth.user.id)
    .in('status', ['pending', 'sending', 'sent', 'failed', 'cancelled'])
    .order('scheduled_at', { ascending: true })
    .limit(200)

  // Build a map of lead_id → lead for lookups
  const leadMap = new Map(leads.map(l => [l.id, l]))

  // Build scheduled follow-ups list
  const scheduled: ScheduledFollowUp[] = (scheduledRows || []).map(row => {
    const lead = leadMap.get(row.lead_id)
    return {
      id: row.id,
      leadId: row.lead_id,
      leadName: lead?.owner_name || 'Unknown',
      phone: lead?.phone || null,
      messageText: row.message_text,
      scheduledAt: row.scheduled_at,
      status: row.status,
      sentAt: row.sent_at,
    }
  })

  // Build follow-up items from leads
  const followups: FollowUpItem[] = []

  for (const lead of leads) {
    if (!lead.last_contacted) continue
    if (!lead.phone && !lead.email) continue

    const leadMessages = messagesByLead.get(lead.id) || []
    const lastSentDate = new Date(lead.last_contacted)
    const daysSince = daysBetween(lastSentDate, now)

    const lastOutbound = leadMessages.find(m => m.direction === 'outbound')
    const inboundAfterSent = leadMessages.filter(
      m => m.direction === 'inbound' && new Date(m.created_at) > lastSentDate
    )
    const latestResponse = inboundAfterSent[0]

    let responseStatus: FollowUpItem['responseStatus'] = 'no_response'
    let suggestedAction = ''

    if (latestResponse) {
      const body = (latestResponse.body || '').toLowerCase()
      const status = (lead.status || '').toLowerCase()

      if (status.includes('not_interested') || body.includes('stop') || body.includes('unsubscribe')) {
        responseStatus = 'not_interested'
        suggestedAction = 'Remove from follow-up list'
      } else if (status.includes('interested') || body.includes('yes') || body.includes('interested')) {
        responseStatus = 'interested'
        suggestedAction = 'Schedule a call or meeting'
      } else if (body.includes('later') || body.includes('busy') || body.includes('not now') || body.includes('maybe')) {
        responseStatus = 'needs_followup'
        suggestedAction = 'Re-engage in 7 days — lead showed soft interest'
      } else {
        responseStatus = 'replied'
        suggestedAction = 'Review conversation and respond'
      }
    } else {
      if (daysSince >= 30) {
        suggestedAction = 'Send 30-day follow-up (final attempt)'
      } else if (daysSince >= 14) {
        suggestedAction = 'Send 14-day follow-up (re-engagement)'
      } else if (daysSince >= 7) {
        suggestedAction = 'Send 7-day follow-up (final check-in)'
      } else if (daysSince >= 3) {
        suggestedAction = 'Send 3-day follow-up (gentle reminder)'
      } else if (daysSince >= 1) {
        suggestedAction = 'Send 1-day follow-up (quick check-in)'
      } else {
        suggestedAction = 'Wait — contacted today'
      }
    }

    // Include ALL leads (don't hide interested/not_interested)
    followups.push({
      id: lead.id,
      leadId: lead.id,
      phone: lead.phone || null,
      email: lead.email || null,
      ownerName: lead.owner_name || '',
      propertyAddress: lead.property_address || '',
      daysSinceContact: daysSince,
      lastSent: lead.last_contacted,
      lastResponse: latestResponse?.body,
      responseStatus,
      suggestedAction,
      originalMessage: lastOutbound?.body || '',
    })
  }

  // Sort: no_response first, then needs_followup, then by days desc
  const statusOrder: Record<string, number> = {
    no_response: 0, needs_followup: 1, replied: 2, interested: 3, not_interested: 4,
  }
  followups.sort((a, b) => {
    const orderDiff = (statusOrder[a.responseStatus] ?? 5) - (statusOrder[b.responseStatus] ?? 5)
    if (orderDiff !== 0) return orderDiff
    return b.daysSinceContact - a.daysSinceContact
  })

  const stats = {
    total: followups.length,
    no_response: followups.filter(f => f.responseStatus === 'no_response').length,
    needs_followup: followups.filter(f => f.responseStatus === 'needs_followup').length,
    replied: followups.filter(f => f.responseStatus === 'replied').length,
    interested: followups.filter(f => f.responseStatus === 'interested').length,
    not_interested: followups.filter(f => f.responseStatus === 'not_interested').length,
  }

  return NextResponse.json({ ok: true, followups, scheduled, stats })
}

// DELETE /api/followups?id=xxx — cancel a scheduled follow-up
export async function DELETE(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Follow-up ID required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify ownership and only cancel pending ones
  const { data: followUp } = await supabase
    .from('follow_ups')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single()

  if (!followUp) {
    return NextResponse.json({ ok: false, error: 'Follow-up not found' }, { status: 404 })
  }

  if (followUp.status !== 'pending') {
    return NextResponse.json({ ok: false, error: `Cannot cancel — status is ${followUp.status}` }, { status: 400 })
  }

  const { error } = await supabase
    .from('follow_ups')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await logActivity(auth.user.id, 'followup.cancel', `Cancelled follow-up ${id}`, 'success')
  return NextResponse.json({ ok: true, cancelled: true })
}
