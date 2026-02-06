import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { fetchPeople, convertPersonToLead } from '@/app/lib/integrations/follow-up-boss'

/**
 * POST /api/integrations/fub/sync
 * Sync leads from Follow Up Boss to our database
 */
export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get the FUB connection
  const { data: connection, error: connError } = await supabase
    .from('crm_connections')
    .select('id, api_key, last_sync_at')
    .eq('user_id', auth.user.id)
    .eq('provider', 'follow_up_boss')
    .eq('status', 'active')
    .single()

  if (connError || !connection || !connection.api_key) {
    return NextResponse.json(
      { ok: false, error: 'Follow Up Boss not connected' },
      { status: 400 }
    )
  }

  console.log('[FUB Sync] Starting sync for user:', auth.user.id)

  // Fetch people from FUB
  const fetchResult = await fetchPeople(connection.api_key, {
    limit: 100,
    updatedSince: connection.last_sync_at || undefined,
  })

  if (!fetchResult.ok) {
    // Update connection status to error
    await supabase
      .from('crm_connections')
      .update({
        status: 'error',
        error_message: fetchResult.error,
      })
      .eq('id', connection.id)

    return NextResponse.json(
      { ok: false, error: fetchResult.error },
      { status: 500 }
    )
  }

  const people = fetchResult.people || []
  console.log(`[FUB Sync] Fetched ${people.length} people from FUB`)

  let synced = 0
  let updated = 0
  let errors = 0

  for (const person of people) {
    const lead = convertPersonToLead(person)

    try {
      // Check if lead already exists (by crm_id)
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', auth.user.id)
        .eq('crm_id', lead.crm_id)
        .eq('crm_provider', 'follow_up_boss')
        .single()

      if (existing) {
        // Update existing lead
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            owner_name: lead.owner_name,
            email: lead.email,
            phone: lead.phone,
            property_address: lead.property_address,
            status: lead.status,
            tags: lead.tags,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('[FUB Sync] Update error:', updateError)
          errors++
        } else {
          updated++
        }
      } else {
        // Insert new lead
        const { error: insertError } = await supabase
          .from('leads')
          .insert({
            user_id: auth.user.id,
            ...lead,
          })

        if (insertError) {
          console.error('[FUB Sync] Insert error:', insertError)
          errors++
        } else {
          synced++
        }
      }
    } catch (err) {
      console.error('[FUB Sync] Error processing person:', person.id, err)
      errors++
    }
  }

  // Update last sync time
  await supabase
    .from('crm_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      status: 'active',
      error_message: null,
    })
    .eq('id', connection.id)

  // Log the activity
  await logActivity(
    auth.user.id,
    'crm_sync',
    `Synced ${synced} new leads, updated ${updated} existing leads from Follow Up Boss`,
    errors > 0 ? 'pending' : 'success',
    { provider: 'follow_up_boss', synced, updated, errors, total: people.length }
  )

  console.log(`[FUB Sync] Complete - synced: ${synced}, updated: ${updated}, errors: ${errors}`)

  return NextResponse.json({
    ok: true,
    message: `Synced ${synced} new leads, updated ${updated} existing`,
    stats: {
      total: people.length,
      synced,
      updated,
      errors,
    },
  })
}
