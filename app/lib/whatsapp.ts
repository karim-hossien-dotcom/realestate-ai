export type WhatsAppTemplateParams = {
  to: string;
  templateName?: string;
  languageCode?: string;
  bodyParams?: string[];
};

type WhatsAppSendResult = {
  ok: boolean;
  status: number;
  data: { response?: unknown } | null;
  error?: string;
};

export async function sendWhatsAppTemplate(
  params: WhatsAppTemplateParams
): Promise<WhatsAppSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const defaultTemplateName = process.env.WHATSAPP_TEMPLATE_NAME;

  if (!phoneNumberId || !accessToken || !(params.templateName || defaultTemplateName)) {
    return {
      ok: false,
      status: 400,
      error:
        'WhatsApp credentials not set. Configure WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME.',
      data: null,
    };
  }

  const templateName = params.templateName || defaultTemplateName || '';
  const languageCode = params.languageCode || 'en_US';
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

  const payload = {
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template,
  };

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
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

  return {
    ok: true,
    status: response.status,
    data: { response: responseJson },
  };
}
