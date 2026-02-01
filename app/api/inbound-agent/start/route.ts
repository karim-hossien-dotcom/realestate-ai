import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const pythonDir =
  process.env.FOLLOWUPS_PY_DIR || 'C:\\Users\\karim\\OneDrive\\Desktop\\Agent AI';
const scriptName = 'ai_inbound_agent.py';
const pidFile = path.join(process.cwd(), '.inbound-agent.pid');

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function POST() {
  if (fs.existsSync(pidFile)) {
    const existingPid = Number(fs.readFileSync(pidFile, 'utf-8').trim());
    if (existingPid && isRunning(existingPid)) {
      return NextResponse.json({
        ok: true,
        running: true,
        pid: existingPid,
        url: 'http://localhost:5000/sms',
        status: 'running',
        message: 'Inbound agent already running.',
        data: { pid: existingPid, url: 'http://localhost:5000/sms' },
      });
    }
    fs.unlinkSync(pidFile);
  }

  const startProcess = (command: string) =>
    spawn(command, [scriptName], {
      cwd: pythonDir,
      detached: true,
      stdio: 'ignore',
    });

  let child = startProcess('python');
  if (!child.pid) {
    child = startProcess('py');
  }

  if (!child.pid) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unable to start inbound agent. Python not found.',
        data: null,
      },
      { status: 500 }
    );
  }

  child.unref();

  fs.writeFileSync(pidFile, String(child.pid));

  return NextResponse.json({
    ok: true,
    running: true,
    pid: child.pid,
    url: 'http://localhost:5000/sms',
    status: 'running',
    message: 'Inbound agent started.',
    data: { pid: child.pid, url: 'http://localhost:5000/sms' },
  });
}
