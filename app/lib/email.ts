import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailParams = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  fromName?: string; // Agent's name - shows as "Nadine Khalil <outreach@domain.com>"
};

export type EmailSendResult = {
  ok: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Send an email using Resend
 */
export async function sendEmail(params: EmailParams): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmailBase = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  // Format: "Agent Name <email@domain.com>" if fromName provided
  const fromEmail = params.fromName
    ? `${params.fromName} <${fromEmailBase}>`
    : fromEmailBase;

  if (!apiKey) {
    return {
      ok: false,
      error: 'RESEND_API_KEY not configured',
    };
  }

  try {
    console.log('[Email] Sending to:', params.to, 'from:', fromEmail);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html || params.text || '',
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error) {
      console.error('[Email] Send error:', error);
      return {
        ok: false,
        error: error.message,
      };
    }

    console.log('[Email] Sent successfully:', data?.id);
    return {
      ok: true,
      messageId: data?.id,
    };
  } catch (err) {
    console.error('[Email] Unexpected error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Generate HTML email from template
 */
export function generateOutreachEmail(params: {
  recipientName: string;
  propertyAddress: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  customMessage?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Regarding your property at ${params.propertyAddress}`;

  const message = params.customMessage || `I noticed your property at ${params.propertyAddress} and wanted to reach out. I specialize in helping property owners in your area, and I'd love to discuss how I can assist you with any real estate needs you might have.`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi ${params.recipientName},</p>

  <p>${message}</p>

  <p>Would you be open to a quick call to discuss? I'm available at your convenience.</p>

  <p>Best regards,</p>

  <p>
    <strong>${params.agentName}</strong><br>
    ${params.agentPhone}<br>
    <a href="mailto:${params.agentEmail}">${params.agentEmail}</a>
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

  <p style="font-size: 12px; color: #666;">
    If you no longer wish to receive emails from us, please reply with "UNSUBSCRIBE" and we'll remove you from our list.
  </p>
</body>
</html>
`;

  const text = `Hi ${params.recipientName},

${message}

Would you be open to a quick call to discuss? I'm available at your convenience.

Best regards,
${params.agentName}
${params.agentPhone}
${params.agentEmail}

---
If you no longer wish to receive emails from us, please reply with "UNSUBSCRIBE" and we'll remove you from our list.
`;

  return { subject, html, text };
}

/**
 * Generate follow-up email
 */
export function generateFollowUpEmail(params: {
  recipientName: string;
  propertyAddress: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  followUpNumber: number;
}): { subject: string; html: string; text: string } {
  const subjects = [
    `Following up - ${params.propertyAddress}`,
    `Quick check-in about your property`,
    `Still interested in connecting?`,
  ];

  const messages = [
    `I wanted to follow up on my previous email regarding your property at ${params.propertyAddress}. I understand you're busy, but I'd still love the opportunity to discuss how I can help.`,
    `I hope this message finds you well. I'm still interested in connecting about your property at ${params.propertyAddress}. Even if now isn't the right time, I'm happy to be a resource for any real estate questions you might have.`,
    `I wanted to reach out one more time about your property at ${params.propertyAddress}. If you're not interested, no worries at all - just let me know and I won't bother you again. But if you'd like to chat, I'm here to help.`,
  ];

  const idx = Math.min(params.followUpNumber - 1, 2);
  const subject = subjects[idx];
  const message = messages[idx];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <p>Hi ${params.recipientName},</p>

  <p>${message}</p>

  <p>Feel free to call or text me anytime.</p>

  <p>Best,</p>

  <p>
    <strong>${params.agentName}</strong><br>
    ${params.agentPhone}<br>
    <a href="mailto:${params.agentEmail}">${params.agentEmail}</a>
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

  <p style="font-size: 12px; color: #666;">
    Reply "UNSUBSCRIBE" to stop receiving emails.
  </p>
</body>
</html>
`;

  const text = `Hi ${params.recipientName},

${message}

Feel free to call or text me anytime.

Best,
${params.agentName}
${params.agentPhone}
${params.agentEmail}

---
Reply "UNSUBSCRIBE" to stop receiving emails.
`;

  return { subject, html, text };
}
