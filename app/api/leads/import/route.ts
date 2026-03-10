import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { checkPhonesTaken } from '@/app/lib/api'
import { applyMapping } from '@/app/lib/csv-mapper'
import { checkUsageLimits, limitExceededPayload, isUsageLimitResult } from '@/app/lib/usage'

// Strip leading characters that trigger formula execution in spreadsheet apps
function sanitizeCsvValue(val: string | null | undefined): string | null {
  if (!val) return null
  return val.replace(/^[=+\-@\t\r]+/, '')
}

export async function POST(req: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mappingJson = formData.get('mapping') as string | null

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file provided.' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const name = file.name.toLowerCase()

    if (!name.endsWith('.csv')) {
      return NextResponse.json(
        { ok: false, error: 'Only CSV files are supported.' },
        { status: 400 }
      )
    }

    // Parse CSV
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[]

    if (records.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'CSV file is empty or has no valid rows.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Parse column mapping if provided
    let columnMapping: Record<string, string> | null = null
    if (mappingJson) {
      try {
        columnMapping = JSON.parse(mappingJson)
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Invalid mapping JSON.' },
          { status: 400 }
        )
      }
    }

    // Build leads using either the smart mapping or legacy exact-header behavior
    const allLeads = records.map(record => {
      if (columnMapping) {
        // Smart mapping path
        const mapped = applyMapping(record, columnMapping)
        return {
          user_id: auth.user.id,
          property_address: sanitizeCsvValue(mapped.property_address),
          owner_name: sanitizeCsvValue(mapped.owner_name),
          phone: mapped.phone?.replace(/[^0-9+\-() ]/g, '') || null,
          email: mapped.email || null,
          contact_preference: mapped.contact_preference || 'sms',
          status: mapped.status || 'new',
          notes: sanitizeCsvValue(mapped.notes),
          tags: mapped.tags || [],
          score: 50,
          score_category: 'Warm',
        }
      }

      // Legacy path — exact header match (backwards compatible)
      return {
        user_id: auth.user.id,
        property_address: sanitizeCsvValue(record.property_address),
        owner_name: sanitizeCsvValue(record.owner_name),
        phone: record.phone?.replace(/[^0-9+\-() ]/g, '') || null,
        email: record.email || null,
        contact_preference: record.contact_preference || 'sms',
        status: record.status || 'new',
        notes: sanitizeCsvValue(record.notes),
        tags: [],
        score: 50,
        score_category: 'Warm',
      }
    })

    // Check for cross-user phone duplicates
    const phonesToCheck = allLeads.map(l => l.phone).filter(Boolean) as string[]
    const takenPhones = await checkPhonesTaken(phonesToCheck, auth.user.id)

    // Filter out leads whose phone belongs to another agent
    let leadsToInsert = allLeads.filter(lead => {
      if (!lead.phone) return true
      const normalized = lead.phone.replace(/^\+/, '')
      return !takenPhones.has(normalized)
    })
    const duplicates = allLeads.length - leadsToInsert.length

    // Check lead count against plan limits
    const usage = await checkUsageLimits(auth.user.id, 'leads')
    let truncated = 0
    if (!usage.allowed) {
      return NextResponse.json(limitExceededPayload(usage, 'leads'), { status: 402 })
    }
    // Cap import to remaining lead capacity
    if (isUsageLimitResult(usage) && usage.remaining !== Infinity && leadsToInsert.length > usage.remaining) {
      truncated = leadsToInsert.length - usage.remaining
      leadsToInsert = leadsToInsert.slice(0, usage.remaining)
    }

    // Insert leads in batches of 100
    const BATCH_SIZE = 100
    let inserted = 0
    const errors: string[] = []

    if (duplicates > 0) {
      const dupList = Array.from(takenPhones.entries())
        .map(([phone, owner]) => `${phone} (${owner})`)
        .slice(0, 10)
        .join(', ')
      errors.push(`${duplicates} leads skipped — phone already assigned to another agent: ${dupList}`)
    }

    if (truncated > 0 && isUsageLimitResult(usage)) {
      errors.push(`${truncated} leads skipped — ${usage.planName} plan limit of ${usage.limit} leads reached (${usage.remaining} slots were available). Upgrade for more capacity.`)
    }

    for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
      const batch = leadsToInsert.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from('leads')
        .insert(batch)
        .select('id')

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      } else {
        inserted += data?.length || 0
      }
    }

    // Also create consent records for imported leads (implied consent from CSV)
    const leadsWithPhone = leadsToInsert.filter(l => l.phone)
    if (leadsWithPhone.length > 0) {
      const consentRecords = leadsWithPhone.map(lead => ({
        user_id: auth.user.id,
        phone: lead.phone!,
        consent_type: 'sms_marketing',
        consent_given: true,
        source: 'csv_import',
      }))

      // Insert consent records (ignore duplicates)
      await supabase
        .from('consent_records')
        .upsert(consentRecords, { onConflict: 'user_id,phone', ignoreDuplicates: true })
    }

    // Log the import activity
    await logActivity(
      auth.user.id,
      'data_import',
      `CSV import completed: ${inserted} leads added${duplicates > 0 ? `, ${duplicates} duplicates` : ''}`,
      'success',
      {
        fileName: file.name,
        totalRows: records.length,
        inserted,
        duplicates,
        errors: errors.length,
      }
    )

    return NextResponse.json({
      ok: true,
      message: `Imported ${inserted} leads from ${file.name}`,
      stats: {
        total: records.length,
        inserted,
        duplicates,
        truncated,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Import failed.'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
