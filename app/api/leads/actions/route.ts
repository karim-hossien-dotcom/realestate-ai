import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

export async function GET(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')

  const supabase = await createClient()

  if (leadId) {
    // Get single lead with follow-ups
    const { data: lead, error } = await supabase
      .from('leads')
      .select(`
        *,
        follow_ups (*)
      `)
      .eq('id', leadId)
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, data: lead })
  }

  // Get all leads
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, owner_name, phone, tags, notes')

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data: leads })
}

export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)

  if (!body || !body.leadId || !body.action) {
    return NextResponse.json(
      { ok: false, error: 'Missing leadId or action' },
      { status: 400 }
    )
  }

  const { leadId, action } = body
  const supabase = await createClient()

  switch (action) {
    case 'schedule_meeting': {
      const { date, time, note } = body
      if (!date || !time) {
        return NextResponse.json(
          { ok: false, error: 'Missing date or time' },
          { status: 400 }
        )
      }

      // Create a follow-up for the meeting
      const scheduledAt = new Date(`${date}T${time}:00`)
      const { error } = await supabase.from('follow_ups').insert({
        user_id: auth.user.id,
        lead_id: leadId,
        message_text: note || 'Scheduled meeting',
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
      })

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      await logActivity(
        auth.user.id,
        'appointment',
        `Meeting scheduled for ${date} at ${time}`,
        'success',
        { leadId, date, time }
      )

      return NextResponse.json({ ok: true, message: 'Meeting scheduled' })
    }

    case 'add_followup': {
      const { dueDate, note } = body
      if (!dueDate) {
        return NextResponse.json(
          { ok: false, error: 'Missing dueDate' },
          { status: 400 }
        )
      }

      const { error } = await supabase.from('follow_ups').insert({
        user_id: auth.user.id,
        lead_id: leadId,
        message_text: note || 'Follow up with lead',
        scheduled_at: new Date(dueDate).toISOString(),
        status: 'pending',
      })

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'Follow-up added' })
    }

    case 'update_tags': {
      const { tags } = body
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { ok: false, error: 'Tags must be an array' },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('leads')
        .update({ tags })
        .eq('id', leadId)

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'Tags updated' })
    }

    case 'save_notes': {
      const { notes } = body

      const { error } = await supabase
        .from('leads')
        .update({ notes: notes || '' })
        .eq('id', leadId)

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'Notes saved' })
    }

    case 'update_status': {
      const { status } = body

      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, message: 'Status updated' })
    }

    case 'add_to_dnc': {
      // Get lead phone
      const { data: lead } = await supabase
        .from('leads')
        .select('phone')
        .eq('id', leadId)
        .single()

      if (!lead?.phone) {
        return NextResponse.json({ ok: false, error: 'Lead has no phone' }, { status: 400 })
      }

      // Add to DNC list
      const { error } = await supabase.from('dnc_list').insert({
        user_id: auth.user.id,
        phone: lead.phone,
        reason: body.reason || 'User requested',
        source: 'manual',
      })

      if (error && !error.message.includes('duplicate')) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }

      // Update lead status
      await supabase
        .from('leads')
        .update({ status: 'do_not_contact' })
        .eq('id', leadId)

      await logActivity(
        auth.user.id,
        'opt_out',
        `Lead added to DNC list`,
        'success',
        { leadId, phone: lead.phone }
      )

      return NextResponse.json({ ok: true, message: 'Added to DNC list' })
    }

    default:
      return NextResponse.json(
        { ok: false, error: `Unknown action: ${action}` },
        { status: 400 }
      )
  }
}
