import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const pythonDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');
const scriptName = 'build_followups.py';
const leadsCsv = 'output_full.csv';
const followupsCsv = 'followups.csv';

function runPython(command: string) {
  return spawnSync(command, [scriptName, leadsCsv, followupsCsv], {
    cwd: pythonDir,
    encoding: 'utf-8',
    timeout: 120000,
  });
}

export async function POST() {
  const inputPath = path.join(pythonDir, leadsCsv);
  if (!fs.existsSync(inputPath)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Run "Step 2: Enrich" first. Missing ${leadsCsv}.`,
        data: null,
      },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: 'Demo mode: OPENAI_API_KEY not set. Follow-ups were not generated.',
      data: null,
    });
  }

  let result = runPython('python3');
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    result = runPython('python');
    if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      result = runPython('py');
    }
  }

  const stdout = (result.stdout || '').toString().trim();
  const stderr = (result.stderr || '').toString().trim();

  if (result.error || result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error?.message || stderr || 'Build follow-ups failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Follow-ups built.',
    data: { stdout, stderr },
  });
}
