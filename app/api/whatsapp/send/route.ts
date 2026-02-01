import { NextResponse } from 'next/server';

import { sendWhatsAppTemplate } from '@/app/lib/whatsapp';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const to = String(body?.to || '').trim();
  const templateName = typeof body?.templateName === 'string' ? body.templateName : undefined;
  const languageCode = typeof body?.languageCode === 'string' ? body.languageCode : undefined;
  const bodyParams = Array.isArray(body?.bodyParams)
    ? body.bodyParams.map((param: unknown) => String(param))
    : [];

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log('[DEMO MODE] WhatsApp message simulated');
    return NextResponse.json({
      ok: true,
      message: 'WhatsApp message sent.',
      data: {
        demo: true,
        to,
        templateName,
        languageCode,
        bodyParams,
      },
    });
  }

  if (!to) {
    return NextResponse.json(
      { ok: false, error: 'Missing WhatsApp recipient phone.', data: null },
      { status: 400 }
    );
  }

  const result = await sendWhatsAppTemplate({
    to,
    templateName,
    languageCode,
    bodyParams,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error || 'WhatsApp send failed.', data: result.data },
      { status: result.status || 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'WhatsApp message sent.',
    data: result.data,
  });
}
