import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth } from '@/app/lib/auth'

/**
 * GET /api/integrations/fub/status
 * Get Follow Up Boss connection status
 */
export async function GET() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { data: connection, error } = await supabase
    .from('crm_connections')
    .select('id, status, last_sync_at, error_message, created_at')
    .eq('user_id', auth.user.id)
    .eq('provider', 'follow_up_boss')
    .single()

  if (error || !connection) {
    return NextResponse.json({
      ok: true,
      connected: false,
    })
  }

  // Get count of leads synced from FUB
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('crm_provider', 'follow_up_boss')

  return NextResponse.json({
    ok: true,
    connected: true,
    status: connection.status,
    lastSyncAt: connection.last_sync_at,
    errorMessage: connection.error_message,
    connectedAt: connection.created_at,
    leadsFromCrm: count || 0,
  })
}
