/**
 * One-time migration script to move CSV data to Supabase
 *
 * Run with: npx tsx scripts/migrate-csv-to-supabase.ts
 *
 * Prerequisites:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Run the schema SQL in supabase/schema.sql
 * 3. Create an admin user via the Supabase auth UI or signup
 * 4. Set environment variables:
 *    - NEXT_PUBLIC_SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *    - MIGRATION_USER_ID (UUID of the user to assign data to)
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
let USER_ID = process.env.MIGRATION_USER_ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const toolsDir = path.join(process.cwd(), 'tools')
const publicDir = path.join(process.cwd(), 'public')

async function getUserId(): Promise<string> {
  if (USER_ID) return USER_ID

  // Auto-detect user from profiles table
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .limit(1)
    .single()

  if (error || !data) {
    console.error('Error: Could not find a user. Create an account first.')
    process.exit(1)
  }

  console.log(`  Auto-detected user: ${data.email}`)
  return data.id
}

type CsvRecord = Record<string, string>

function readCsv(filename: string): CsvRecord[] {
  const filepath = path.join(toolsDir, filename)
  if (!fs.existsSync(filepath)) {
    console.log(`  Skipping ${filename} (not found)`)
    return []
  }

  const content = fs.readFileSync(filepath, 'utf-8')
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  } catch (err) {
    console.error(`  Error parsing ${filename}:`, err)
    return []
  }
}

function readCsvFromPath(filepath: string): CsvRecord[] {
  if (!fs.existsSync(filepath)) {
    return []
  }

  const content = fs.readFileSync(filepath, 'utf-8')
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  } catch (err) {
    console.error(`  Error parsing ${filepath}:`, err)
    return []
  }
}

async function migrateLeads() {
  console.log('\n📋 Migrating leads...')

  // Try different CSV sources in order of preference
  let records: CsvRecord[] = []

  // 1. Try public/test_leads.csv first
  const testLeadsPath = path.join(publicDir, 'test_leads.csv')
  records = readCsvFromPath(testLeadsPath)
  if (records.length > 0) {
    console.log(`  Found ${records.length} leads in public/test_leads.csv`)
  }

  // 2. Try tools/output.csv (has generated messages)
  if (records.length === 0) {
    records = readCsv('output.csv')
  }

  // 3. Try tools/leads_template.csv
  if (records.length === 0) {
    records = readCsv('leads_template.csv')
  }

  if (records.length === 0) {
    console.log('  No leads found to migrate')
    return
  }

  const leads = records.map(r => ({
    user_id: USER_ID,
    property_address: r.property_address || null,
    owner_name: r.owner_name || null,
    phone: r.phone || null,
    email: r.email || null,
    contact_preference: (r.contact_preference || 'sms').toLowerCase(),
    status: (r.status || 'new').toLowerCase(),
    notes: r.notes || null,
    sms_text: r.sms_text || null,
    email_text: r.email_body || null,
    tags: [],
    score: 50,
    score_category: 'Warm',
  }))

  const { data, error } = await supabase
    .from('leads')
    .insert(leads)
    .select('id, phone')

  if (error) {
    console.error('  Error migrating leads:', error.message)
  } else {
    console.log(`  ✅ Migrated ${data?.length || 0} leads`)
  }

  return data // Return for cross-referencing
}

async function migrateSentCampaigns(leads: Array<{ id: string; phone: string }> | null) {
  console.log('\n📨 Migrating sent campaigns...')

  const records = readCsv('sent_campaigns.csv')
  if (records.length === 0) {
    console.log('  No sent campaigns found')
    return
  }

  // Create a phone to lead ID map
  const phoneToLead = new Map<string, string>()
  if (leads) {
    for (const lead of leads) {
      if (lead.phone) {
        const normalized = lead.phone.replace(/\D/g, '').slice(-10)
        phoneToLead.set(normalized, lead.id)
      }
    }
  }

  // Create a campaign for the migration
  const { data: campaign } = await supabase
    .from('campaigns')
    .insert({
      user_id: USER_ID,
      name: 'Migrated Campaign',
      status: 'completed',
      total_leads: records.length,
      sent_count: records.filter(r => r.status === 'sent').length,
      failed_count: records.filter(r => r.status === 'failed').length,
    })
    .select()
    .single()

  const messages = records.map(r => {
    const normalizedPhone = (r.phone || '').replace(/\D/g, '').slice(-10)
    const leadId = phoneToLead.get(normalizedPhone) || null

    return {
      user_id: USER_ID,
      lead_id: leadId,
      campaign_id: campaign?.id || null,
      direction: 'outbound' as const,
      channel: 'whatsapp' as const,
      to_number: r.phone || null,
      body: r.message || '',
      status: r.status === 'sent' ? 'sent' : 'failed',
      created_at: r.timestamp || new Date().toISOString(),
    }
  })

  const { error } = await supabase.from('messages').insert(messages)

  if (error) {
    console.error('  Error migrating sent campaigns:', error.message)
  } else {
    console.log(`  ✅ Migrated ${messages.length} sent messages`)
  }
}

async function migrateInboundMessages(leads: Array<{ id: string; phone: string }> | null) {
  console.log('\n📥 Migrating inbound messages...')

  const records = readCsv('logs/inbound.csv')
  if (records.length === 0) {
    console.log('  No inbound messages found')
    return
  }

  // Create a phone to lead ID map
  const phoneToLead = new Map<string, string>()
  if (leads) {
    for (const lead of leads) {
      if (lead.phone) {
        const normalized = lead.phone.replace(/\D/g, '').slice(-10)
        phoneToLead.set(normalized, lead.id)
      }
    }
  }

  const messages = records.map(r => {
    const normalizedPhone = (r.wa_id || r.from_number || '').replace(/\D/g, '').slice(-10)
    const leadId = phoneToLead.get(normalizedPhone) || null

    return {
      user_id: USER_ID,
      lead_id: leadId,
      direction: 'inbound' as const,
      channel: 'whatsapp' as const,
      from_number: r.wa_id || r.from_number || null,
      body: r.body || r.incoming_body || '',
      status: 'received',
      external_id: r.message_id || null,
      created_at: r.timestamp_utc || new Date().toISOString(),
    }
  })

  const { error } = await supabase.from('messages').insert(messages)

  if (error) {
    console.error('  Error migrating inbound messages:', error.message)
  } else {
    console.log(`  ✅ Migrated ${messages.length} inbound messages`)
  }
}

async function migrateStoppedNumbers() {
  console.log('\n🚫 Migrating DNC list...')

  const records = readCsv('logs/stopped.csv')
  if (records.length === 0) {
    console.log('  No stopped numbers found')
    return
  }

  const dncEntries = records.map(r => ({
    user_id: USER_ID,
    phone: (r.wa_id || r.phone || '').replace(/^\+/, ''),
    reason: 'STOP keyword (migrated)',
    source: 'migration',
  }))

  const { error } = await supabase
    .from('dnc_list')
    .upsert(dncEntries, { onConflict: 'user_id,phone', ignoreDuplicates: true })

  if (error) {
    console.error('  Error migrating DNC list:', error.message)
  } else {
    console.log(`  ✅ Migrated ${dncEntries.length} DNC entries`)
  }
}

async function migrateActivityLogs() {
  console.log('\n📝 Migrating activity logs...')

  const logsFile = path.join(toolsDir, 'activity_logs.json')
  if (!fs.existsSync(logsFile)) {
    console.log('  No activity logs found')
    return
  }

  try {
    const data = JSON.parse(fs.readFileSync(logsFile, 'utf-8'))
    const logs = data.logs || []

    if (logs.length === 0) {
      console.log('  No activity logs to migrate')
      return
    }

    const entries = logs.map((log: Record<string, unknown>) => ({
      user_id: USER_ID,
      event_type: log.eventType || 'system',
      description: log.description || '',
      status: log.status || 'success',
      metadata: log.metadata || null,
      created_at: log.timestamp || new Date().toISOString(),
    }))

    const { error } = await supabase.from('activity_logs').insert(entries)

    if (error) {
      console.error('  Error migrating activity logs:', error.message)
    } else {
      console.log(`  ✅ Migrated ${entries.length} activity log entries`)
    }
  } catch (err) {
    console.error('  Error reading activity logs:', err)
  }
}

async function migrateFollowUps(leads: Array<{ id: string; phone: string }> | null) {
  console.log('\n⏰ Migrating follow-ups...')

  const records = readCsv('followups.csv')
  if (records.length === 0) {
    console.log('  No follow-ups found')
    return
  }

  // Create a phone to lead ID map
  const phoneToLead = new Map<string, string>()
  if (leads) {
    for (const lead of leads) {
      if (lead.phone) {
        const normalized = lead.phone.replace(/\D/g, '').slice(-10)
        phoneToLead.set(normalized, lead.id)
      }
    }
  }

  const followUps = records
    .map(r => {
      const normalizedPhone = (r.phone || '').replace(/\D/g, '').slice(-10)
      const leadId = phoneToLead.get(normalizedPhone)

      if (!leadId) return null

      return {
        user_id: USER_ID,
        lead_id: leadId,
        message_text: r.message_text || '',
        scheduled_at: r.send_date || new Date().toISOString(),
        status: r.status || 'pending',
      }
    })
    .filter(Boolean)

  if (followUps.length === 0) {
    console.log('  No follow-ups could be matched to leads')
    return
  }

  const { error } = await supabase.from('follow_ups').insert(followUps)

  if (error) {
    console.error('  Error migrating follow-ups:', error.message)
  } else {
    console.log(`  ✅ Migrated ${followUps.length} follow-ups`)
  }
}

async function main() {
  console.log('🚀 Starting CSV to Supabase migration')
  console.log(`   Supabase URL: ${SUPABASE_URL}`)

  // Get user ID (auto-detect if not provided)
  USER_ID = await getUserId()
  console.log(`   User ID: ${USER_ID}`)

  // Migrate in order of dependencies
  const leads = await migrateLeads()
  await migrateSentCampaigns(leads || null)
  await migrateInboundMessages(leads || null)
  await migrateStoppedNumbers()
  await migrateActivityLogs()
  await migrateFollowUps(leads || null)

  console.log('\n✅ Migration complete!')
  console.log('\nNext steps:')
  console.log('1. Verify data in Supabase dashboard')
  console.log('2. Update environment variables on Render')
  console.log('3. Deploy the updated application')
}

main().catch(console.error)
