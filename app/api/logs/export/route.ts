import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/app/lib/auth';
import { rateLimitExport } from '@/app/lib/rate-limit';
import { createClient } from '@/app/lib/supabase/server';

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

  // Calculate start date from time range
  const now = new Date();
  const startDate = new Date();
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

  const supabase = await createClient();

  // Build query scoped to this user
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', auth.user.id)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (eventType && eventType !== 'all') {
    query = query.eq('event_type', eventType);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: 'Failed to fetch logs' }, { status: 500 });
  }

  const filteredLogs = logs || [];

  if (format === 'json') {
    return new NextResponse(JSON.stringify(filteredLogs, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="logs_export_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  // CSV format
  const headers = ['Timestamp', 'Event Type', 'Description', 'Status', 'Additional Info'];
  const csvRows = [headers.join(',')];

  for (const log of filteredLogs) {
    const metadata = log.metadata as Record<string, unknown> | null;
    const row = [
      `"${log.created_at}"`,
      `"${log.event_type || ''}"`,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      `"${log.status || ''}"`,
      `"${metadata ? JSON.stringify(metadata).replace(/"/g, '""') : ''}"`,
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
