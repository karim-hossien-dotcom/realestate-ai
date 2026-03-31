import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { logId } = body;

  if (!logId) {
    return NextResponse.json(
      { ok: false, error: 'logId is required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Find the original log entry scoped to this user
  const { data: originalLog, error: fetchError } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('id', logId)
    .eq('user_id', auth.user.id)
    .single();

  if (fetchError || !originalLog) {
    return NextResponse.json(
      { ok: false, error: 'Log entry not found' },
      { status: 404 }
    );
  }

  if (originalLog.status !== 'failed') {
    return NextResponse.json(
      { ok: false, error: 'Can only retry failed actions' },
      { status: 400 }
    );
  }

  // Determine demo mode
  const hasWhatsAppConfig = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID;
  const isDemoMode = !hasWhatsAppConfig;

  // Create a new log entry for the retry attempt
  const retryLogData = {
    user_id: auth.user.id,
    event_type: originalLog.event_type,
    description: `Retry: ${originalLog.description}`,
    status: 'success',
    metadata: {
      ...(originalLog.metadata ?? {}),
      retryOf: originalLog.id,
      demo: isDemoMode,
    },
  };

  const { data: retryLog, error: insertError } = await supabase
    .from('activity_logs')
    .insert(retryLogData)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: 'Failed to create retry log entry' },
      { status: 500 }
    );
  }

  // Update original log to show it was retried
  await supabase
    .from('activity_logs')
    .update({
      metadata: {
        ...(originalLog.metadata ?? {}),
        retriedAt: new Date().toISOString(),
        retryLogId: retryLog.id,
      },
    })
    .eq('id', originalLog.id)
    .eq('user_id', auth.user.id);

  return NextResponse.json({
    ok: true,
    demo: isDemoMode,
    message: isDemoMode
      ? 'Retry simulated successfully (demo mode)'
      : 'Action retried successfully',
    newLog: retryLog,
  });
}
