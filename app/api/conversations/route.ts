import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import { createServiceClient } from '@/app/lib/supabase/server'

// GET /api/conversations - Get list of conversations (leads with messages)
export async function GET(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  // If leadId provided, get messages for that lead
  if (leadId) {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', auth.user.id)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ ok: false, error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, messages })
  }

  // Otherwise, get list of leads with recent message info
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select(`
      id,
      owner_name,
      phone,
      email,
      status,
      score_category,
      last_contacted,
      last_response,
      property_interest,
      budget_min,
      budget_max
    `)
    .eq('user_id', auth.user.id)
    .order('last_response', { ascending: false, nullsFirst: false })
    .limit(50)

  if (leadsError) {
    console.error('Error fetching leads:', leadsError)
    return NextResponse.json({ ok: false, error: 'Failed to fetch conversations' }, { status: 500 })
  }

  // Get message counts and last message for each lead
  const conversationsWithMessages = await Promise.all(
    leads.map(async (lead) => {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, body, direction, created_at, channel')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', lead.id)
        .eq('direction', 'inbound')

      return {
        ...lead,
        lastMessage: messages?.[0] || null,
        unreadCount: count || 0
      }
    })
  )

  // Filter to only leads with messages, or include all if none have messages
  const withMessages = conversationsWithMessages.filter(c => c.lastMessage)
  const result = withMessages.length > 0 ? withMessages : conversationsWithMessages.slice(0, 10)

  return NextResponse.json({ ok: true, conversations: result })
}
