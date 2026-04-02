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

/**
 * Normalize a phone number for WhatsApp (must include country code).
 * 10-digit US numbers get '1' prepended. Strips +, spaces, dashes, parens.
 */
function normalizeForWhatsApp(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  // 10-digit US number → prepend country code 1
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

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

  const toNumber = normalizeForWhatsApp(params.to);

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

/**
 * Check if a phone number is likely reachable on WhatsApp.
 * Quick heuristics (toll-free, short numbers) + Meta contacts API.
 * Returns { valid: true, waId } or { valid: false, reason }.
 */
export async function checkWhatsAppNumber(
  phone: string
): Promise<{ valid: boolean; waId?: string; reason?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const normalized = normalizeForWhatsApp(phone);

  // Quick reject: toll-free numbers
  if (/^1(800|888|877|866|855|844|833)\d{7}$/.test(normalized)) {
    return { valid: false, reason: 'Toll-free number' };
  }

  // Quick reject: too short
  if (normalized.length < 10) {
    return { valid: false, reason: 'Number too short' };
  }

  if (!phoneNumberId || !accessToken) {
    return { valid: true };
  }

  try {
    // Meta Cloud API: send a contacts check
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blocking: 'wait',
          contacts: [`+${normalized}`],
          force_check: true,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    const contact = data?.contacts?.[0];

    if (contact?.status === 'valid' && contact?.wa_id) {
      return { valid: true, waId: contact.wa_id };
    }
    if (contact?.status === 'invalid') {
      return { valid: false, reason: 'Not on WhatsApp' };
    }

    // Contacts API may not be available on all tiers — assume valid
    return { valid: true };
  } catch {
    return { valid: true }; // Don't block on network errors
  }
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

  const toNumber = normalizeForWhatsApp(params.to);

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
