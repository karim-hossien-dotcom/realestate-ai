import { NextResponse } from 'next/server';

type NormalizedInbound = {
  from: string;
  to: string;
  body: string;
  messageId?: string;
  timestamp?: string;
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
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
      };
    }>;
  }>;
};

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch('http://localhost:5000/whatsapp/webhook', {
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
  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: 'Invalid WhatsApp webhook payload.', data: null },
      { status: 400 }
    );
  }

  const inbound = extractInboundMessages(payload);
  console.log(`[whatsapp/webhook] inbound_count=${inbound.length}`);

  if (inbound.length === 0) {
    return NextResponse.json({ ok: true, message: 'No inbound messages.', data: null });
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
