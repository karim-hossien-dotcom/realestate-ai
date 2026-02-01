import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';

const pythonDir =
  process.env.FOLLOWUPS_PY_DIR || 'C:\\Users\\karim\\OneDrive\\Desktop\\Agent AI';
const scriptName = 'ai_listing_agent_full.py';

const inputCsv = process.env.LISTING_AGENT_INPUT || 'output.csv';
const outputCsv = process.env.LISTING_AGENT_OUTPUT || 'output_full.csv';
const baseScript = process.env.LISTING_AGENT_BASE_SCRIPT || 'base_script.txt';
const agentName = process.env.LISTING_AGENT_NAME || 'Nadine Khalil';
const brokerage = process.env.LISTING_AGENT_BROKERAGE || 'KW Commercial';

function runPython(command: string) {
  return spawnSync(
    command,
    [scriptName, inputCsv, outputCsv, baseScript, agentName, brokerage],
    {
      cwd: pythonDir,
      encoding: 'utf-8',
      timeout: 120000,
    }
  );
}

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message:
        'Demo mode: OPENAI_API_KEY not set. Listing agent generation skipped.',
      data: null,
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
        error: result.error?.message || stderr || 'Listing agent run failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Listing agent completed.',
    data: { stdout, stderr },
  });
}
