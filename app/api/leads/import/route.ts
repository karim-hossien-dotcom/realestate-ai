import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'

type CsvLead = {
  property_address?: string
  owner_name?: string
  phone?: string
  email?: string
  contact_preference?: string
  status?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

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
    }) as CsvLead[]

    if (records.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'CSV file is empty or has no valid rows.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Prepare leads for insert
    const leadsToInsert = records.map(record => ({
      user_id: auth.user.id,
      property_address: record.property_address || null,
      owner_name: record.owner_name || null,
      phone: record.phone || null,
      email: record.email || null,
      contact_preference: record.contact_preference || 'sms',
      status: record.status || 'new',
      notes: record.notes || null,
      tags: [],
      score: 50,
      score_category: 'Warm',
    }))

    // Insert leads in batches of 100
    const BATCH_SIZE = 100
    let inserted = 0
    let duplicates = 0
    const errors: string[] = []

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
