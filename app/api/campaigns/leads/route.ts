import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const toolsDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

type CsvRecord = {
  property_address?: string;
  owner_name?: string;
  phone?: string;
  email?: string;
  sms_text?: string;
  [key: string]: string | undefined;
};

type Lead = {
  owner_name: string;
  phone: string;
  property_address: string;
  sms_text: string;
  email: string;
};

export async function GET() {
  const fullPath = path.join(toolsDir, 'output_full.csv');
  const basicPath = path.join(toolsDir, 'output.csv');

  let csvPath: string | null = null;

  if (fs.existsSync(fullPath)) {
    csvPath = fullPath;
  } else if (fs.existsSync(basicPath)) {
    csvPath = basicPath;
  }

  if (!csvPath) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No leads output found. Run Generate on the Leads page first.',
        leads: [],
      },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as CsvRecord[];

    const leads: Lead[] = records
      .filter(r => r.phone || r.owner_name)
      .map(r => ({
        owner_name: r.owner_name || '',
        phone: r.phone || '',
        property_address: r.property_address || '',
        sms_text: r.sms_text || '',
        email: r.email || '',
      }));

    return NextResponse.json({
      ok: true,
      source: path.basename(csvPath),
      leads,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse CSV';
    return NextResponse.json(
      { ok: false, error: message, leads: [] },
      { status: 500 }
    );
  }
}
