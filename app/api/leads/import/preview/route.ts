import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { withAuth } from '@/app/lib/auth'
import { autoMapColumns } from '@/app/lib/csv-mapper'

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

    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      return NextResponse.json(
        { ok: false, error: 'Only CSV files are supported.' },
        { status: 400 }
      )
    }

    const text = await file.text()

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

    const headers = Object.keys(records[0])
    const sampleRows = records.slice(0, 100)
    const mapping = autoMapColumns(headers, sampleRows)

    return NextResponse.json({
      ok: true,
      headers,
      mapping,
      preview: sampleRows.slice(0, 5),
      totalRows: records.length,
      previewRows: Math.min(5, records.length),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Preview failed.'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
