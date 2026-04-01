import { NextResponse } from 'next/server';

type NormalizedInbound = {
  from: string;
  to: string;
  body: string;
  messageId?: string;
  timestamp?: string;
};

type WhatsAppStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  errors?: Array<{ code: number; title: string }>;
};

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          type?: string;
          text?: { body?: string };
          from?: string;
          id?: string;
          timestamp?: string;
        }>;
        statuses?: WhatsAppStatus[];
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
      };
    }>;
  }>;
};

function extractStatuses(payload: unknown): WhatsAppStatus[] {
  const data = payload as WhatsAppWebhookPayload | null;
  const entries = Array.isArray(data?.entry) ? data.entry : [];
  const statuses: WhatsAppStatus[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const statusList = Array.isArray(value?.statuses) ? value.statuses : [];
      for (const s of statusList) {
        if (s?.id && s?.status) {
          statuses.push(s);
        }
      }
    }
  }
  return statuses;
}

async function updateMessageStatuses(statuses: WhatsAppStatus[]) {
  if (statuses.length === 0) return;

  const { createServiceClient } = await import('@/app/lib/supabase/server');
  const supabase = createServiceClient();

  for (const s of statuses) {
    const update: Record<string, string> = { status: s.status };
    if (s.errors?.length) {
      update.error_message = s.errors.map(e => `${e.code}: ${e.title}`).join('; ');
    }

    const { error } = await supabase
      .from('messages')
      .update(update)
      .eq('external_id', s.id);

    if (error) {
      console.error(`[whatsapp/webhook] status update failed for ${s.id}:`, error.message);
    } else {
      console.log(`[whatsapp/webhook] status=${s.status} for ${s.id}`);
    }
  }
}

function normalizePhone(input?: string | null) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function extractInboundMessages(payload: unknown): NormalizedInbound[] {
  const data = payload as WhatsAppWebhookPayload | null;
  const entries = Array.isArray(data?.entry) ? data.entry : [];
  const inbound: NormalizedInbound[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      const metadata = value?.metadata || {};
      const to =
        normalizePhone(metadata?.display_phone_number) ||
        String(metadata?.phone_number_id || '').trim();

      for (const message of messages) {
        if (message?.type !== 'text') {
          continue;
        }
        const body = String(message?.text?.body || '').trim();
        if (!body) {
          continue;
        }
        inbound.push({
          from: normalizePhone(message?.from || ''),
          to,
          body,
          messageId: message?.id ? String(message.id) : undefined,
          timestamp: message?.timestamp ? String(message.timestamp) : undefined,
        });
      }
    }
  }

  return inbound;
}

async function forwardToInboundAgent(payload: unknown) {
  const agentUrl = process.env.INBOUND_AGENT_URL || 'http://localhost:5001';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(`${agentUrl}/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      text || `Inbound agent rejected message (status ${response.status}).`
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.warn('[whatsapp/webhook] verify token not configured');
    return new Response('Verify token not configured.', { status: 500 });
  }

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[whatsapp/webhook] verification succeeded');
    return new Response(challenge || '', { status: 200 });
  }

  console.warn('[whatsapp/webhook] verification failed');
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  // Verify Meta X-Hub-Signature-256 if app secret is configured
  const appSecret = process.env.META_APP_SECRET;
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      console.warn('[whatsapp/webhook] Missing X-Hub-Signature-256 header');
      return NextResponse.json({ ok: false, error: 'Missing signature.' }, { status: 401 });
    }

    const body = await request.text();
    const { createHmac } = await import('crypto');
    const expectedSig = 'sha256=' + createHmac('sha256', appSecret).update(body).digest('hex');

    if (signature !== expectedSig) {
      console.warn('[whatsapp/webhook] Invalid signature');
      return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 403 });
    }

    // Parse the body we already read
    let payload: unknown;
    try { payload = JSON.parse(body); } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 });
    }

    // Process delivery status updates (sent → delivered → read → failed)
    const statuses = extractStatuses(payload);
    if (statuses.length > 0) {
      await updateMessageStatuses(statuses);
    }

    const inbound = extractInboundMessages(payload);
    console.log(`[whatsapp/webhook] inbound_count=${inbound.length} statuses=${statuses.length} (signature verified)`);

    if (inbound.length === 0) {
      return NextResponse.json({ ok: true, message: statuses.length > 0 ? `Processed ${statuses.length} status update(s).` : 'No inbound messages.', data: null });
    }

    try {
      await forwardToInboundAgent(payload);
    } catch (err) {
      console.error('[whatsapp/webhook] inbound forward failed', err);
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Forwarding failed.', data: null }, { status: 502 });
    }

    return NextResponse.json({ ok: true, message: `Processed ${inbound.length} message(s).`, data: null });
  }

  // Fallback: no app secret configured — process without signature check
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: 'Invalid WhatsApp webhook payload.', data: null },
      { status: 400 }
    );
  }

  // Process delivery status updates (sent → delivered → read → failed)
  const statuses2 = extractStatuses(payload);
  if (statuses2.length > 0) {
    await updateMessageStatuses(statuses2);
  }

  const inbound = extractInboundMessages(payload);
  console.log(`[whatsapp/webhook] inbound_count=${inbound.length} statuses=${statuses2.length}`);

  if (inbound.length === 0) {
    return NextResponse.json({ ok: true, message: statuses2.length > 0 ? `Processed ${statuses2.length} status update(s).` : 'No inbound messages.', data: null });
  }

  try {
    await forwardToInboundAgent(payload);
  } catch (err) {
    console.error('[whatsapp/webhook] inbound forward failed', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Inbound forwarding failed.',
        data: null,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Inbound WhatsApp messages stored.',
    data: { count: inbound.length },
  });
}
