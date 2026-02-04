import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const toolsDir = process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

type Lead = {
  property_address: string;
  owner_name: string;
  phone: string;
  email: string;
  contact_preference?: string;
  last_contacted?: string;
  status?: string;
  notes?: string;
  sms_text?: string;
};

export async function GET() {
  // Try output.csv first (has generated messages), then leads_template.csv
  const outputPath = path.join(toolsDir, 'output.csv');
  const templatePath = path.join(toolsDir, 'leads_template.csv');

  let csvPath = '';
  let source = '';

  if (fs.existsSync(outputPath)) {
    csvPath = outputPath;
    source = 'output.csv';
  } else if (fs.existsSync(templatePath)) {
    csvPath = templatePath;
    source = 'leads_template.csv';
  } else {
    return NextResponse.json({
      ok: true,
      leads: [],
      source: null,
      message: 'No leads file found. Import a CSV first.',
    });
  }

  try {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Lead[];

    return NextResponse.json({
      ok: true,
      leads: records,
      source,
      total: records.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to parse CSV';
    return NextResponse.json(
      { ok: false, error: message, leads: [] },
      { status: 500 }
    );
  }
}
