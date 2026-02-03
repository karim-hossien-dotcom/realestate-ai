import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const pythonDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');
const scriptName = 'send_followups.py';
const followupsCsv = 'followups.csv';

function runPython(command: string, args: string[]) {
  return spawnSync(command, [scriptName, ...args], {
    cwd: pythonDir,
    encoding: 'utf-8',
    timeout: 60000,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const testToPhone = String(body?.testToPhone || '').trim();

  const csvPath = path.join(pythonDir, followupsCsv);
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Run "Build Follow-Ups" first. Missing ${followupsCsv}.`,
        data: null,
      },
      { status: 400 }
    );
  }

  const pyArgs = [followupsCsv];
  if (testToPhone) {
    pyArgs.push('--test-to-phone', testToPhone);
  }

  let result = runPython('python', pyArgs);
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    result = runPython('py', pyArgs);
  }

  const stdout = (result.stdout || '').toString().trim();
  const stderr = (result.stderr || '').toString().trim();

  if (result.error || result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error?.message || stderr || 'Send follow-ups failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Follow-ups sent.',
    data: { stdout, stderr },
  });
}
