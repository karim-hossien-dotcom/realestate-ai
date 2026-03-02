import { NextRequest, NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { createServiceClient, createClient } from '@/app/lib/supabase/server'
import { sendWhatsAppText } from '@/app/lib/whatsapp'
import { sendEmail } from '@/app/lib/email'
import { sendSms } from '@/app/lib/sms'

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

// POST /api/conversations - Send a message to a lead
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const { leadId, message, channel } = body

  if (!leadId || !message) {
    return NextResponse.json(
      { ok: false, error: 'leadId and message are required' },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()

  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, owner_name, phone, email')
    .eq('id', leadId)
    .eq('user_id', auth.user.id)
    .single()

  if (leadError || !lead) {
    return NextResponse.json(
      { ok: false, error: 'Lead not found' },
      { status: 404 }
    )
  }

  // Check DNC list
  const recipient = channel === 'email' ? lead.email : lead.phone
  if (recipient) {
    const { data: dncEntry } = await supabase
      .from('dnc_list')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('phone', recipient.replace(/^\+/, ''))
      .limit(1)

    if (dncEntry && dncEntry.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'This contact is on the Do Not Contact list' },
        { status: 403 }
      )
    }
  }

  const sendChannel = channel || 'whatsapp'
  let sendResult: { ok: boolean; error?: string; messageId?: string } = { ok: false }

  if (sendChannel === 'whatsapp') {
    if (!lead.phone) {
      return NextResponse.json(
        { ok: false, error: 'Lead has no phone number' },
        { status: 400 }
      )
    }

    if (!process.env.WHATSAPP_ACCESS_TOKEN) {
      // Demo mode
      sendResult = { ok: true, messageId: `demo-${Date.now()}` }
    } else {
      const waResult = await sendWhatsAppText({ to: lead.phone, body: message })
      sendResult = { ok: waResult.ok, error: waResult.error, messageId: waResult.messageId }
    }
  } else if (sendChannel === 'sms') {
    if (!lead.phone) {
      return NextResponse.json(
        { ok: false, error: 'Lead has no phone number' },
        { status: 400 }
      )
    }

    sendResult = await sendSms({ to: lead.phone, body: message })
  } else if (sendChannel === 'email') {
    if (!lead.email) {
      return NextResponse.json(
        { ok: false, error: 'Lead has no email address' },
        { status: 400 }
      )
    }

    // Get agent profile for from name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', auth.user.id)
      .single()

    const emailResult = await sendEmail({
      to: lead.email,
      subject: `Message from ${profile?.full_name || 'Your Agent'}`,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
      fromName: profile?.full_name,
      replyTo: profile?.email,
    })
    sendResult = emailResult
  }

  if (!sendResult.ok) {
    return NextResponse.json(
      { ok: false, error: sendResult.error || 'Failed to send message' },
      { status: 500 }
    )
  }

  // Record the message in the database
  await supabase.from('messages').insert({
    user_id: auth.user.id,
    lead_id: lead.id,
    direction: 'outbound',
    channel: sendChannel,
    to_number: sendChannel === 'email' ? lead.email : lead.phone,  // phone used for both whatsapp and sms
    body: message,
    status: 'sent',
    external_id: sendResult.messageId,
  })

  // Update lead last_contacted
  await supabase
    .from('leads')
    .update({ last_contacted: new Date().toISOString() })
    .eq('id', lead.id)

  // Log activity
  await logActivity(
    auth.user.id,
    'message_reply',
    `Sent ${sendChannel} message to ${lead.owner_name || lead.phone || lead.email}`,
    'success',
    { leadId: lead.id, channel: sendChannel, message: message.slice(0, 200) }
  )

  return NextResponse.json({
    ok: true,
    message: 'Message sent successfully',
    channel: sendChannel,
  })
}
