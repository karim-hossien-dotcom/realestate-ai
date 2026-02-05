import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

// This route is now mostly deprecated since leads are imported directly
// but we keep it for backwards compatibility
export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Count existing leads
  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }

  if (count === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No leads found. Import a CSV file from the Leads page.',
      data: { leadCount: 0 },
    })
  }

  return NextResponse.json({
    ok: true,
    message: `${count} leads ready. You can now generate messages.`,
    data: { leadCount: count },
  })
}
