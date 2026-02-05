import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

type FollowUp = {
  id: string
  leadId: string
  phone: string
  ownerName: string
  propertyAddress: string
  daysSinceContact: number
  lastSent: string
  lastResponse?: string
  responseStatus: 'no_response' | 'replied' | 'needs_followup' | 'not_interested' | 'interested'
  suggestedAction: string
  originalMessage: string
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

  // Get all leads with their latest outbound message and any inbound responses
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select(`
      id,
      owner_name,
      property_address,
      phone,
      status,
      last_contacted,
      last_response
    `)
    .not('last_contacted', 'is', null)
    .order('last_contacted', { ascending: false })

  if (leadsError) {
    return NextResponse.json(
      { ok: false, error: leadsError.message },
      { status: 500 }
    )
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      ok: true,
      followups: [],
      stats: { total: 0, no_response: 0, needs_followup: 0, replied: 0 },
      message: 'No campaigns sent yet. Send campaigns first from the Campaigns page.',
    })
  }

  // Get latest messages for each lead
  const { data: messages } = await supabase
    .from('messages')
    .select('lead_id, direction, body, created_at, status')
    .in('lead_id', leads.map(l => l.id))
    .order('created_at', { ascending: false })

  // Group messages by lead
  const messagesByLead = new Map<string, typeof messages>()
  for (const msg of messages || []) {
    if (!msg.lead_id) continue
    if (!messagesByLead.has(msg.lead_id)) {
      messagesByLead.set(msg.lead_id, [])
    }
    messagesByLead.get(msg.lead_id)!.push(msg)
  }

  const followups: FollowUp[] = []

  for (const lead of leads) {
    if (!lead.last_contacted || !lead.phone) continue

    const leadMessages = messagesByLead.get(lead.id) || []
    const lastSentDate = new Date(lead.last_contacted)
    const daysSince = daysBetween(lastSentDate, now)

    // Find last outbound message
    const lastOutbound = leadMessages.find(m => m.direction === 'outbound')

    // Find responses after last sent
    const inboundAfterSent = leadMessages.filter(
      m => m.direction === 'inbound' && new Date(m.created_at) > lastSentDate
    )
    const latestResponse = inboundAfterSent[0]

    let responseStatus: FollowUp['responseStatus'] = 'no_response'
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
      } else {
        responseStatus = 'replied'
        suggestedAction = 'Review conversation and respond'
      }
    } else {
      // No response - suggest follow-up based on days since contact
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
        suggestedAction = 'Wait - contacted today'
      }
    }

    // Only include leads that need follow-up action
    if (responseStatus !== 'not_interested' && responseStatus !== 'interested') {
      followups.push({
        id: lead.id,
        leadId: lead.id,
        phone: lead.phone,
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
  }

  // Sort by priority: no_response first, then by days since contact
  followups.sort((a, b) => {
    if (a.responseStatus === 'no_response' && b.responseStatus !== 'no_response') return -1
    if (b.responseStatus === 'no_response' && a.responseStatus !== 'no_response') return 1
    return b.daysSinceContact - a.daysSinceContact
  })

  const stats = {
    total: followups.length,
    no_response: followups.filter(f => f.responseStatus === 'no_response').length,
    needs_followup: followups.filter(f => f.responseStatus === 'needs_followup').length,
    replied: followups.filter(f => f.responseStatus === 'replied').length,
  }

  return NextResponse.json({
    ok: true,
    followups,
    stats,
  })
}
