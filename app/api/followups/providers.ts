import { NextResponse } from 'next/server';

export type ProviderName = 'whatsapp' | 'email';

export function normalizeProvider(value: unknown): ProviderName {
  return value === 'email' ? 'email' : 'whatsapp';
}

export async function sendViaProvider(request: Request, body: Record<string, unknown>) {
  const provider = normalizeProvider(body?.provider);

  if (provider === 'email') {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: 'Email follow-ups are not configured. Choose WhatsApp.',
      data: null,
    });
  }

  const url = new URL('/api/whatsapp/send', request.url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  return NextResponse.json(
    {
      ok: Boolean(data?.ok),
      message: data?.message,
      error: data?.error,
      data: data?.data ?? null,
    },
    { status: res.status }
  );
}
