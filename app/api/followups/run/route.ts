import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const pythonDir =
  process.env.FOLLOWUPS_PY_DIR || 'C:\\Users\\karim\\OneDrive\\Desktop\\Agent AI';
const scriptName = 'followup_scheduler.py';

function runPython(command: string) {
  return spawnSync(command, [scriptName], {
    cwd: pythonDir,
    encoding: 'utf-8',
    timeout: 30000,
  });
}

export async function POST() {
  const demoMode = process.env.FOLLOWUPS_DEMO !== '0';

  if (demoMode) {
    const samples: Array<{ name: string; phone: string; message: string }> = [];
    try {
      const leadsPath = path.join(pythonDir, 'leads_state.csv');
      if (fs.existsSync(leadsPath)) {
        const raw = fs.readFileSync(leadsPath, 'utf-8').trim();
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const headers = lines.shift()?.split(',') ?? [];
        const nameIdx = headers.indexOf('name');
        const phoneIdx = headers.indexOf('phone');
        const addressIdx = headers.indexOf('address');

        for (const line of lines.slice(0, 3)) {
          const cols = line.split(',');
          const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : '';
          const phone = phoneIdx >= 0 ? cols[phoneIdx]?.trim() : '';
          const address = addressIdx >= 0 ? cols[addressIdx]?.trim() : '';
          const firstName = name ? name.split(' ')[0] : 'there';
          const message = `Hi ${firstName}, this is a demo follow-up about ${address || 'your property'}.`;
          samples.push({ name, phone, message });
        }
      }
    } catch (err) {
      // Ignore demo sample failures.
    }

    return NextResponse.json({
      ok: true,
      demo: true,
      message:
        'Demo mode: follow-ups simulated. Set FOLLOWUPS_DEMO=0 to run the scheduler.',
      data: { samples },
    });
  }

  let result = runPython('python');
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    result = runPython('py');
  }

  const stdout = (result.stdout || '').toString().trim();
  const stderr = (result.stderr || '').toString().trim();

  if (result.error || result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error?.message || stderr || 'Python follow-ups failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Follow-ups run complete.',
    data: { stdout, stderr },
  });
}
