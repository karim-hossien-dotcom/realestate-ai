import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const toolsDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    const text = await file.text();
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      const templatePath = path.join(toolsDir, 'leads_template.csv');
      fs.writeFileSync(templatePath, text, 'utf-8');
      return NextResponse.json({
        ok: true,
        message: 'CSV imported as leads_template.csv. Run Init to load it.',
      });
    }

    if (name.endsWith('.json')) {
      JSON.parse(text); // validate
      const statePath = path.join(toolsDir, 'leads_state.json');
      fs.writeFileSync(statePath, text, 'utf-8');
      return NextResponse.json({
        ok: true,
        message: 'Leads state imported.',
      });
    }

    return NextResponse.json(
      { ok: false, error: 'Unsupported file type. Use .csv or .json.' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Import failed.' },
      { status: 500 }
    );
  }
}
