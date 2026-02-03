import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const toolsDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

export async function GET() {
  const statePath = path.join(toolsDir, 'leads_state.json');

  if (!fs.existsSync(statePath)) {
    return NextResponse.json(
      { ok: false, error: 'No leads state found. Run Init first.' },
      { status: 404 }
    );
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="leads_state.json"',
    },
  });
}
