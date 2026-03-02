export type SmsParams = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send an SMS using Twilio REST API (no SDK needed)
 */
export async function sendSms(params: SmsParams): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('[SMS] Twilio credentials not configured — demo mode');
    return { ok: true, messageId: `demo-sms-${Date.now()}` };
  }

  const toNumber = params.to.startsWith('+') ? params.to : `+${params.to}`;

  const formData = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Body: params.body,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      error: data?.message || `Twilio error ${response.status}`,
    };
  }

  return {
    ok: true,
    messageId: data?.sid || undefined,
  };
}
