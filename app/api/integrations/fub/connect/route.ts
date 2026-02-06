import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { testConnection } from '@/app/lib/integrations/follow-up-boss'

/**
 * POST /api/integrations/fub/connect
 * Connect Follow Up Boss integration by saving API key
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  let body: { apiKey: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!body.apiKey || typeof body.apiKey !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'API key is required' },
      { status: 400 }
    )
  }

  const apiKey = body.apiKey.trim()

  // Test the connection first
  console.log('[FUB] Testing connection...')
  const testResult = await testConnection(apiKey)

  if (!testResult.ok) {
    console.error('[FUB] Connection test failed:', testResult.error)
    return NextResponse.json(
      { ok: false, error: `Connection failed: ${testResult.error}` },
      { status: 400 }
    )
  }

  console.log('[FUB] Connection successful, user:', testResult.user?.name)

  // Save or update the connection
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('crm_connections')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('provider', 'follow_up_boss')
    .single()

  if (existing) {
    // Update existing connection
    const { error: updateError } = await supabase
      .from('crm_connections')
      .update({
        api_key: apiKey,
        status: 'active',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error('[FUB] Update error:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Failed to update connection' },
        { status: 500 }
      )
    }
  } else {
    // Create new connection
    const { error: insertError } = await supabase
      .from('crm_connections')
      .insert({
        user_id: auth.user.id,
        provider: 'follow_up_boss',
        api_key: apiKey,
        status: 'active',
      })

    if (insertError) {
      console.error('[FUB] Insert error:', insertError)
      return NextResponse.json(
        { ok: false, error: 'Failed to save connection' },
        { status: 500 }
      )
    }
  }

  // Log the activity
  await logActivity(
    auth.user.id,
    'crm_connected',
    `Connected Follow Up Boss integration`,
    'success',
    { provider: 'follow_up_boss', user: testResult.user?.name }
  )

  return NextResponse.json({
    ok: true,
    message: 'Connected successfully',
    user: testResult.user,
  })
}

/**
 * DELETE /api/integrations/fub/connect
 * Disconnect Follow Up Boss integration
 */
export async function DELETE() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  const { error } = await supabase
    .from('crm_connections')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('provider', 'follow_up_boss')

  if (error) {
    console.error('[FUB] Delete error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to disconnect' },
      { status: 500 }
    )
  }

  await logActivity(
    auth.user.id,
    'crm_disconnected',
    'Disconnected Follow Up Boss integration',
    'success',
    { provider: 'follow_up_boss' }
  )

  return NextResponse.json({ ok: true, message: 'Disconnected successfully' })
}
