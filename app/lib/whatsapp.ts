export type WhatsAppTextParams = {
  to: string;
  body: string;
};

type WhatsAppSendTextResult = {
  ok: boolean;
  status: number;
  data: { response?: unknown } | null;
  error?: string;
  messageId?: string;
};

export async function sendWhatsAppText(
  params: WhatsAppTextParams
): Promise<WhatsAppSendTextResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      status: 400,
      error: 'WhatsApp credentials not set.',
      data: null,
    };
  }

  const toNumber = params.to.replace(/^\+/, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'text',
    text: { body: params.body },
  };

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const responseJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: responseJson?.error?.message || 'WhatsApp send failed.',
      data: { response: responseJson },
    };
  }

  const messageId = responseJson?.messages?.[0]?.id;

  return {
    ok: true,
    status: response.status,
    data: { response: responseJson },
    messageId,
  };
}

export type WhatsAppTemplateParams = {
  to: string;
  templateName?: string;
  languageCode?: string;
  bodyParams?: string[];
};

/**
 * Send a WhatsApp template message (works outside the 24-hour window).
 * Use for campaigns and cold outreach. Once the lead replies,
 * switch to sendWhatsAppText() for free-form conversation.
 */
export async function sendWhatsAppTemplate(
  params: WhatsAppTemplateParams
): Promise<WhatsAppSendTextResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const templateName = params.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'realestate_outreach';

  if (!phoneNumberId || !accessToken || !templateName) {
    return {
      ok: false,
      status: 400,
      error: 'WhatsApp credentials or template name not configured.',
      data: null,
    };
  }

  const languageCode = params.languageCode || 'en';
  const bodyParams = Array.isArray(params.bodyParams) ? params.bodyParams : [];

  const template: {
    name: string;
    language: { code: string };
    components?: Array<{ type: 'body'; parameters: Array<{ type: 'text'; text: string }> }>;
  } = {
    name: templateName,
    language: { code: languageCode },
  };

  if (bodyParams.length > 0) {
    template.components = [
      {
        type: 'body',
        parameters: bodyParams.map((text) => ({ type: 'text', text })),
      },
    ];
  }

  const toNumber = params.to.replace(/^\+/, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: toNumber,
    type: 'template',
    template,
  };

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const responseJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: responseJson?.error?.message || 'WhatsApp template send failed.',
      data: { response: responseJson },
    };
  }

  const messageId = responseJson?.messages?.[0]?.id;

  return {
    ok: true,
    status: response.status,
    data: { response: responseJson },
    messageId,
  };
}
