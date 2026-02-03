import { NextResponse } from 'next/server';
import { spawnSync } from 'child_process';
import path from 'path';

const pythonDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');
const scriptName = 'send_calendar_invite.py';

function runPython(command: string, input: string) {
  return spawnSync(command, [scriptName], {
    cwd: pythonDir,
    encoding: 'utf-8',
    timeout: 120000,
    input,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const leadName = String(body?.leadName || '').trim();
  const leadEmail = String(body?.leadEmail || '').trim();
  const subject = String(body?.subject || '').trim() || 'Call about your property';
  const description =
    String(body?.description || '').trim() ||
    'Looking forward to speaking with you about your property.';
  const startDateTime = String(body?.startDateTime || '').trim();
  const durationMinutes = String(body?.durationMinutes || '').trim() || '30';

  if (!leadName || !leadEmail || !startDateTime) {
    return NextResponse.json(
      { ok: false, error: 'Missing lead name, email, or start time.', data: null },
      { status: 400 }
    );
  }

  const hasEmailEnv =
    !!process.env.ORGANIZER_EMAIL &&
    !!process.env.EMAIL_USER &&
    !!process.env.EMAIL_PASSWORD;

  if (!hasEmailEnv) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message:
        'Demo mode: email credentials not set. Configure ORGANIZER_EMAIL, EMAIL_USER, EMAIL_PASSWORD to send.',
      data: {
        payload: { leadName, leadEmail, subject, description, startDateTime, durationMinutes },
      },
    });
  }

  const input = [
    leadName,
    leadEmail,
    subject,
    description,
    startDateTime,
    durationMinutes,
  ].join('\n');

  let result = runPython('python', input);
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
    result = runPython('py', input);
  }

  const stdout = (result.stdout || '').toString().trim();
  const stderr = (result.stderr || '').toString().trim();

  if (result.error || result.status !== 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error?.message || stderr || 'Send calendar invite failed.',
        data: { stdout, stderr },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Invite sent.',
    data: { stdout, stderr },
  });
}
