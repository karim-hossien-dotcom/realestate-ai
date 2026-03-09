import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, template_name, total_leads, sent_count, failed_count, response_count, created_at, completed_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, campaigns: campaigns || [] })
}
