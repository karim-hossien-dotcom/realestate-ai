import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

type Lead = {
  id: string
  owner_name: string
  phone: string
  property_address: string
  sms_text: string
  email: string
  score: number
  score_category: string
}

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get leads that have generated messages (sms_text)
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, owner_name, phone, property_address, sms_text, email, score, score_category')
    .not('sms_text', 'is', null)
    .not('phone', 'is', null)
    .order('score', { ascending: false })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, leads: [] },
      { status: 500 }
    )
  }

  const formattedLeads: Lead[] = (leads || []).map(l => ({
    id: l.id,
    owner_name: l.owner_name || '',
    phone: l.phone || '',
    property_address: l.property_address || '',
    sms_text: l.sms_text || '',
    email: l.email || '',
    score: l.score || 50,
    score_category: l.score_category || 'Warm',
  }))

  return NextResponse.json({
    ok: true,
    source: 'supabase',
    leads: formattedLeads,
    total: formattedLeads.length,
  })
}
