import { NextRequest, NextResponse } from 'next/server';
import { withAuth, logActivity } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';
import { listEvents, createAppointment, deleteAppointment, refreshAccessToken } from '@/app/lib/google-calendar';

// GET - List upcoming events
export async function GET() {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const supabase = await createClient();

  const { data: tokenData, error: tokenError } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', auth.user.id)
    .single();

  if (tokenError || !tokenData) {
    return NextResponse.json({ ok: false, connected: false, error: 'Google Calendar not connected' });
  }

  try {
    let accessToken = tokenData.access_token;
    if (tokenData.expiry_date && Date.now() > tokenData.expiry_date) {
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      accessToken = newTokens.access_token || accessToken;
      await supabase.from('google_tokens').update({
        access_token: newTokens.access_token,
        expiry_date: newTokens.expiry_date,
        updated_at: new Date().toISOString(),
      }).eq('user_id', auth.user.id);
    }

    const events = await listEvents(accessToken, tokenData.refresh_token, 20);
    return NextResponse.json({ ok: true, connected: true, events });
  } catch (err) {
    console.error('[Calendar Events] Error:', err);
    return NextResponse.json({ ok: false, connected: true, error: err instanceof Error ? err.message : 'Failed to fetch events' });
  }
}

// POST - Create new appointment
export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { summary, description, startTime, endTime, attendeeEmail, location, leadId } = body;

  if (!summary || !startTime || !endTime) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_id', auth.user.id).single();

  if (!tokenData) {
    return NextResponse.json({ ok: false, error: 'Google Calendar not connected' }, { status: 400 });
  }

  try {
    const result = await createAppointment(tokenData.access_token, tokenData.refresh_token, { summary, description, startTime, endTime, attendeeEmail, location });
    await logActivity(auth.user.id, 'appointment_created', `Created: ${summary}`, 'success', { eventId: result.eventId, leadId });

    if (leadId) {
      await supabase.from('leads').update({ status: 'appointment_set' }).eq('id', leadId).eq('user_id', auth.user.id);
    }

    return NextResponse.json({ ok: true, eventId: result.eventId, htmlLink: result.htmlLink });
  } catch (err) {
    console.error('[Calendar Create] Error:', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}

// DELETE - Cancel appointment
export async function DELETE(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const eventId = new URL(request.url).searchParams.get('eventId');
  if (!eventId) return NextResponse.json({ ok: false, error: 'Missing eventId' }, { status: 400 });

  const supabase = await createClient();
  const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_id', auth.user.id).single();

  if (!tokenData) return NextResponse.json({ ok: false, error: 'Not connected' }, { status: 400 });

  try {
    await deleteAppointment(tokenData.access_token, tokenData.refresh_token, eventId);
    await logActivity(auth.user.id, 'appointment_cancelled', `Cancelled: ${eventId}`, 'success');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
