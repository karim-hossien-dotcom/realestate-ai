import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const logsFile = path.join(process.cwd(), 'tools', 'activity_logs.json');

export type LogEntry = {
  id: string;
  timestamp: string;
  eventType: 'campaign_send' | 'message_reply' | 'error' | 'appointment' | 'data_import' | 'compliance' | 'opt_out' | 'followup' | 'system';
  description: string;
  user: string;
  status: 'success' | 'failed' | 'pending' | 'received' | 'sent' | 'approved' | 'warning';
  metadata?: {
    phone?: string;
    campaignName?: string;
    leadName?: string;
    errorMessage?: string;
    count?: number;
    [key: string]: unknown;
  };
};

type LogsStore = {
  logs: LogEntry[];
  stats: {
    totalEvents: number;
    errorsToday: number;
    successRate: number;
    avgResponseTime: number;
  };
};

function loadLogs(): LogsStore {
  if (!fs.existsSync(logsFile)) {
    // Create initial demo data
    const initialData = createDemoLogs();
    saveLogs(initialData);
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(logsFile, 'utf-8'));
  } catch {
    const initialData = createDemoLogs();
    saveLogs(initialData);
    return initialData;
  }
}

function saveLogs(data: LogsStore): void {
  fs.writeFileSync(logsFile, JSON.stringify(data, null, 2));
}

function createDemoLogs(): LogsStore {
  const now = new Date();
  const logs: LogEntry[] = [];

  // Generate demo log entries
  const eventTypes: LogEntry['eventType'][] = ['campaign_send', 'message_reply', 'error', 'appointment', 'data_import', 'compliance', 'opt_out', 'followup', 'system'];
  const statuses: Record<string, LogEntry['status'][]> = {
    campaign_send: ['success', 'failed', 'sent'],
    message_reply: ['received', 'success'],
    error: ['failed'],
    appointment: ['sent', 'success'],
    data_import: ['success', 'failed'],
    compliance: ['approved', 'warning'],
    opt_out: ['success'],
    followup: ['sent', 'pending'],
    system: ['success', 'warning'],
  };

  const descriptions: Record<string, string[]> = {
    campaign_send: [
      'Campaign "Holiday Specials" sent to 245 leads',
      'Campaign "New Listings Dec" sent to 180 leads',
      'Campaign "Open House Weekend" sent to 92 leads',
    ],
    message_reply: [
      'Inbound reply from Sarah Johnson: "Interested in viewing"',
      'Inbound reply from Mike Davis: "Can you send more info?"',
      'Inbound reply from Tom Brown: "Thanks for the update"',
    ],
    error: [
      'Failed to send message to +1234567890: Invalid number format',
      'WhatsApp API timeout for +1987654321',
      'Template not approved: "summer_promo_v2"',
    ],
    appointment: [
      'Calendar invite sent to Mike Davis for property viewing',
      'Meeting scheduled with Sarah Johnson at Oak Street property',
      'Follow-up appointment confirmed with Lisa Chen',
    ],
    data_import: [
      'CSV import completed: 125 new leads added, 3 duplicates merged',
      'Bulk import: 50 leads from Zillow export',
      'Manual lead entry: John Williams added',
    ],
    compliance: [
      'A2P campaign "New Listings Dec" approved by carrier',
      'Throughput limit warning: 2,450/3,000 messages sent today',
      'Template "holiday_greeting" approved for use',
    ],
    opt_out: [
      'Lead Emma Wilson (+1555123456) opted out via STOP keyword',
      'Lead Robert Taylor unsubscribed from all campaigns',
    ],
    followup: [
      'Follow-up sequence started for 15 warm leads',
      'Automated follow-up sent to Mike Davis',
      'Follow-up reminder: Contact Sarah Johnson today',
    ],
    system: [
      'Daily backup completed successfully',
      'Webhook connection restored',
      'Rate limit reset for WhatsApp API',
    ],
  };

  // Generate 50 log entries over the past 7 days
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);

    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(timestamp.getHours() - hoursAgo);
    timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const statusOptions = statuses[eventType];
    const status = statusOptions[Math.floor(Math.random() * statusOptions.length)];
    const descOptions = descriptions[eventType];
    const description = descOptions[Math.floor(Math.random() * descOptions.length)];

    logs.push({
      id: `log-${Date.now()}-${i}`,
      timestamp: timestamp.toISOString(),
      eventType,
      description,
      user: Math.random() > 0.3 ? 'John Smith' : 'System',
      status,
      metadata: {
        phone: `+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
      },
    });
  }

  // Sort by timestamp descending
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate stats
  const today = new Date().toISOString().split('T')[0];
  const errorsToday = logs.filter(l => l.status === 'failed' && l.timestamp.startsWith(today)).length;
  const successCount = logs.filter(l => l.status !== 'failed').length;

  return {
    logs,
    stats: {
      totalEvents: logs.length,
      errorsToday,
      successRate: Math.round((successCount / logs.length) * 1000) / 10,
      avgResponseTime: 1.2,
    },
  };
}

function generateId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search')?.toLowerCase() || '';
  const eventType = searchParams.get('type') || '';
  const timeRange = searchParams.get('range') || '7d';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

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

  // Filter by search term
  if (search) {
    filteredLogs = filteredLogs.filter(log =>
      log.description.toLowerCase().includes(search) ||
      log.user.toLowerCase().includes(search) ||
      log.eventType.toLowerCase().includes(search) ||
      (log.metadata?.phone && log.metadata.phone.includes(search))
    );
  }

  // Calculate stats for filtered data
  const today = new Date().toISOString().split('T')[0];
  const errorsToday = data.logs.filter(l => l.status === 'failed' && l.timestamp.startsWith(today)).length;
  const totalSuccess = data.logs.filter(l => l.status !== 'failed').length;

  const stats = {
    totalEvents: data.logs.length,
    errorsToday,
    successRate: data.logs.length > 0 ? Math.round((totalSuccess / data.logs.length) * 1000) / 10 : 100,
    avgResponseTime: 1.2,
  };

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limit);

  return NextResponse.json({
    ok: true,
    logs: paginatedLogs,
    stats,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const { eventType, description, user, status, metadata } = body;

  if (!eventType || !description) {
    return NextResponse.json(
      { ok: false, error: 'eventType and description are required' },
      { status: 400 }
    );
  }

  const data = loadLogs();

  const newLog: LogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    eventType,
    description,
    user: user || 'System',
    status: status || 'success',
    metadata,
  };

  data.logs.unshift(newLog);
  data.stats.totalEvents = data.logs.length;

  saveLogs(data);

  return NextResponse.json({ ok: true, log: newLog });
}
