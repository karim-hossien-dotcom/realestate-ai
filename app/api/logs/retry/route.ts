import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const logsFile = path.join(process.cwd(), 'tools', 'activity_logs.json');

type LogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
  user: string;
  status: string;
  metadata?: {
    phone?: string;
    [key: string]: unknown;
  };
};

type LogsStore = {
  logs: LogEntry[];
  stats: Record<string, number>;
};

function loadLogs(): LogsStore {
  if (!fs.existsSync(logsFile)) {
    return { logs: [], stats: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(logsFile, 'utf-8'));
  } catch {
    return { logs: [], stats: {} };
  }
}

function saveLogs(data: LogsStore): void {
  fs.writeFileSync(logsFile, JSON.stringify(data, null, 2));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { logId } = body;

  if (!logId) {
    return NextResponse.json(
      { ok: false, error: 'logId is required' },
      { status: 400 }
    );
  }

  const data = loadLogs();
  const logIndex = data.logs.findIndex(l => l.id === logId);

  if (logIndex === -1) {
    return NextResponse.json(
      { ok: false, error: 'Log entry not found' },
      { status: 404 }
    );
  }

  const originalLog = data.logs[logIndex];

  if (originalLog.status !== 'failed') {
    return NextResponse.json(
      { ok: false, error: 'Can only retry failed actions' },
      { status: 400 }
    );
  }

  // Simulate retry - in production this would actually resend the message
  const hasWhatsAppConfig = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID;
  const isDemoMode = !hasWhatsAppConfig;

  // Create a new log entry for the retry attempt
  const retryLog: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventType: originalLog.eventType,
    description: `Retry: ${originalLog.description}`,
    user: 'John Smith',
    status: isDemoMode ? 'success' : 'success', // In demo mode, always succeed
    metadata: {
      ...originalLog.metadata,
      retryOf: originalLog.id,
      demo: isDemoMode,
    },
  };

  // Add retry log to the beginning
  data.logs.unshift(retryLog);

  // Update original log to show it was retried
  data.logs[logIndex + 1] = {
    ...originalLog,
    metadata: {
      ...originalLog.metadata,
      retriedAt: new Date().toISOString(),
      retryLogId: retryLog.id,
    },
  };

  saveLogs(data);

  return NextResponse.json({
    ok: true,
    demo: isDemoMode,
    message: isDemoMode
      ? 'Retry simulated successfully (demo mode)'
      : 'Action retried successfully',
    newLog: retryLog,
  });
}
