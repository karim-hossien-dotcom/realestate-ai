import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const pythonDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');
const scriptName = 'ai_listing_agent.py';

const inputCsv =
  process.env.LISTING_AGENT_BASIC_INPUT || 'leads_template.csv';
const outputCsv =
  process.env.LISTING_AGENT_BASIC_OUTPUT || 'output.csv';
const baseScript =
  process.env.LISTING_AGENT_BASE_SCRIPT || 'base_script.txt';
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
  const missing: string[] = [];
  if (!fs.existsSync(path.join(pythonDir, inputCsv))) missing.push(inputCsv);
  if (!fs.existsSync(path.join(pythonDir, baseScript))) missing.push(baseScript);
  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Missing files in tools/: ${missing.join(', ')}. Run "Init Leads" first or add base_script.txt.`,
        data: null,
      },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message:
        'Demo mode: OPENAI_API_KEY not set. Listing agent generation skipped.',
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
        error: result.error?.message || stderr || 'Listing agent (basic) failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  // Count leads in output file
  let leadCount = 0;
  const outputPath = path.join(pythonDir, outputCsv);
  if (fs.existsSync(outputPath)) {
    const content = fs.readFileSync(outputPath, 'utf-8');
    leadCount = content.split('\n').filter(line => line.trim()).length - 1; // minus header
  }

  return NextResponse.json({
    ok: true,
    message: `Generated personalized messages for ${leadCount} leads.`,
    data: { stdout, stderr, leadCount },
  });
}
