import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';

const pythonDir =
  process.env.FOLLOWUPS_PY_DIR || 'C:\\Users\\karim\\OneDrive\\Desktop\\Agent AI';
const scriptName = 'init_leads_state.py';

function runPython(command: string) {
  return spawnSync(command, [scriptName], {
    cwd: pythonDir,
    encoding: 'utf-8',
    timeout: 30000,
  });
}

export async function POST() {
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
        error: result.error?.message || stderr || 'Init leads failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Leads state initialized.',
    data: { stdout, stderr },
  });
}
