import { NextResponse } from 'next/server';
import { sendWhatsAppTemplate } from '@/app/lib/whatsapp';
import fs from 'fs';
import path from 'path';

const toolsDir = process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');
const sentLogPath = path.join(toolsDir, 'sent_campaigns.csv');
const activityLogsPath = path.join(toolsDir, 'activity_logs.json');

function logSentMessage(lead: LeadInput, success: boolean, error?: string) {
  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    lead.phone || '',
    lead.owner_name || '',
    (lead.sms_text || '').replace(/"/g, '""'),
    success ? 'sent' : 'failed',
  ].map(v => `"${v}"`).join(',');

  // Create header if file doesn't exist
  if (!fs.existsSync(sentLogPath)) {
    fs.writeFileSync(sentLogPath, 'timestamp,phone,owner_name,message,status\n');
  }
  fs.appendFileSync(sentLogPath, row + '\n');

  // Also log to activity_logs.json for the Logs page
  logToActivityLogs(lead, success, error);
}

function logToActivityLogs(lead: LeadInput, success: boolean, error?: string) {
  let data: { logs: unknown[]; stats: { totalEvents: number; errorsToday: number; successRate: number; avgResponseTime: number } };
  try {
    if (fs.existsSync(activityLogsPath)) {
      data = JSON.parse(fs.readFileSync(activityLogsPath, 'utf-8'));
    } else {
      data = { logs: [], stats: { totalEvents: 0, errorsToday: 0, successRate: 100, avgResponseTime: 1.2 } };
    }
  } catch {
    data = { logs: [], stats: { totalEvents: 0, errorsToday: 0, successRate: 100, avgResponseTime: 1.2 } };
  }

  const logEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventType: 'campaign_send',
    description: success
      ? `WhatsApp message sent to ${lead.owner_name || lead.phone}`
      : `Failed to send WhatsApp message to ${lead.owner_name || lead.phone}${error ? ': ' + error : ''}`,
    user: 'System',
    status: success ? 'sent' : 'failed',
    metadata: {
      phone: lead.phone || '',
      leadName: lead.owner_name || '',
      message: (lead.sms_text || '').substring(0, 100),
      ...(error ? { errorMessage: error } : {}),
    },
  };

  data.logs.unshift(logEntry);
  data.stats.totalEvents = data.logs.length;

  fs.writeFileSync(activityLogsPath, JSON.stringify(data, null, 2));
}

type LeadInput = {
  phone: string;
  sms_text?: string;
  owner_name?: string;
};

type SendResult = {
  phone: string;
  ok: boolean;
  demo?: boolean;
  error?: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const leads: LeadInput[] = Array.isArray(body?.leads) ? body.leads : [];
  const templateName =
    typeof body?.templateName === 'string' ? body.templateName : undefined;
  const languageCode =
    typeof body?.languageCode === 'string' ? body.languageCode : undefined;

  if (leads.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No leads provided.', sent: 0, failed: 0, results: [] },
      { status: 400 }
    );
  }

  const hasWhatsAppConfig =
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    (templateName || process.env.WHATSAPP_TEMPLATE_NAME);
  const isDemoMode = !hasWhatsAppConfig;
  const results: SendResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    const phone = String(lead.phone || '').trim();
    if (!phone) {
      results.push({ phone: '', ok: false, error: 'Missing phone number' });
      failed++;
      continue;
    }

    if (isDemoMode) {
      console.log(`[DEMO MODE] WhatsApp campaign message to ${phone}`);
      logSentMessage(lead, true);
      results.push({ phone, ok: true, demo: true });
      sent++;
      continue;
    }

    // Only pass body parameters if NOT using hello_world template
    // hello_world doesn't accept parameters, custom templates do
    const effectiveTemplate = templateName || process.env.WHATSAPP_TEMPLATE_NAME || '';
    const bodyParams = (effectiveTemplate !== 'hello_world' && lead.sms_text)
      ? [lead.sms_text]
      : [];

    const result = await sendWhatsAppTemplate({
      to: phone,
      templateName,
      languageCode,
      bodyParams,
    });

    if (result.ok) {
      logSentMessage(lead, true);
      results.push({ phone, ok: true });
      sent++;
    } else {
      logSentMessage(lead, false, result.error);
      results.push({ phone, ok: false, error: result.error });
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    demo: isDemoMode,
    sent,
    failed,
    total: leads.length,
    results,
  });
}
