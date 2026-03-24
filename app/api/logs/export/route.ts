import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/app/lib/auth';
import { rateLimitExport } from '@/app/lib/rate-limit';
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
  metadata?: Record<string, unknown>;
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

export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  // Rate limit exports: 5 per minute
  const rl = rateLimitExport(auth.user.id);
  if (rl.limited) {
    return NextResponse.json({ ok: false, error: 'Export rate limit exceeded.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const timeRange = searchParams.get('range') || '7d';
  const eventType = searchParams.get('type') || '';

  const data = loadLogs();
  let filteredLogs = [...data.logs];

  // Filter by time range
  const now = new Date();
  let startDate = new Date();
  switch (timeRange) {
    case '24h':
      startDate.setDate(now.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    default:
      startDate.setDate(now.getDate() - 7);
  }
  filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDate);

  // Filter by event type
  if (eventType && eventType !== 'all') {
    filteredLogs = filteredLogs.filter(log => log.eventType === eventType);
  }

  if (format === 'json') {
    return new NextResponse(JSON.stringify(filteredLogs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="logs_export_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  // CSV format
  const headers = ['Timestamp', 'Event Type', 'Description', 'User', 'Status', 'Phone', 'Additional Info'];
  const csvRows = [headers.join(',')];

  for (const log of filteredLogs) {
    const row = [
      `"${log.timestamp}"`,
      `"${log.eventType}"`,
      `"${log.description.replace(/"/g, '""')}"`,
      `"${log.user}"`,
      `"${log.status}"`,
      `"${log.metadata?.phone || ''}"`,
      `"${log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : ''}"`,
    ];
    csvRows.push(row.join(','));
  }

  const csvContent = csvRows.join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="logs_export_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
