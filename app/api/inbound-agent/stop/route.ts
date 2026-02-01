import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const pidFile = path.join(process.cwd(), '.inbound-agent.pid');

export async function POST() {
  if (!fs.existsSync(pidFile)) {
    return NextResponse.json({
      ok: true,
      running: false,
      status: 'stopped',
      message: 'Inbound agent already stopped.',
      data: null,
    });
  }

  const pid = Number(fs.readFileSync(pidFile, 'utf-8').trim());
  if (pid) {
    try {
      process.kill(pid);
    } catch (err) {
      // ignore if already stopped
    }
  }

  fs.unlinkSync(pidFile);

  return NextResponse.json({
    ok: true,
    running: false,
    status: 'stopped',
    message: 'Inbound agent stopped.',
    data: null,
  });
}
