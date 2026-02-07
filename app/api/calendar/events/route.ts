import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()
  const events: Array<{
    id: string
    date: string
    time: string
    type: string
    phone: string
    note: string
    title?: string
    property_address?: string
    status?: string
    source?: string
  }> = []

  // 1. Fetch from meetings table
  const { data: meetings } = await supabase
    .from('meetings')
    .select('*')
    .order('meeting_date', { ascending: true })

  if (meetings) {
    for (const m of meetings) {
      let date = ''
      let time = ''

      if (m.meeting_date) {
        const dt = new Date(m.meeting_date)
        date = dt.toISOString().split('T')[0]
        time = dt.toTimeString().slice(0, 5)
      } else {
        // No date set - use created_at as fallback
        const dt = new Date(m.created_at)
        date = dt.toISOString().split('T')[0]
        time = ''
      }

      events.push({
        id: m.id,
        date,
        time,
        type: 'meeting',
        phone: m.lead_phone || '',
        note: m.description || m.notes || '',
        title: m.title,
        property_address: m.property_address,
        status: m.status,
        source: m.source,
      })
    }
  }

  // 2. Fetch scheduled follow-ups (they also appear as calendar events)
  const { data: followups } = await supabase
    .from('follow_ups')
    .select('id, lead_id, message_text, scheduled_at, status, leads(phone, owner_name)')
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })

  if (followups) {
    for (const f of followups) {
      let date = ''
      let time = ''

      if (f.scheduled_at) {
        const dt = new Date(f.scheduled_at)
        date = dt.toISOString().split('T')[0]
        time = dt.toTimeString().slice(0, 5)
      }

      const lead = f.leads as { phone?: string; owner_name?: string } | null
      events.push({
        id: f.id,
        date,
        time,
        type: 'followup',
        phone: lead?.phone || '',
        note: f.message_text || '',
      })
    }
  }

  // Sort all events by date
  events.sort((a, b) => {
    const dateA = a.date + (a.time || '99:99')
    const dateB = b.date + (b.time || '99:99')
    return dateA.localeCompare(dateB)
  })

  return NextResponse.json({ ok: true, events })
}
