import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const toolsDir = process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

type SentCampaign = {
  timestamp: string;
  phone: string;
  owner_name: string;
  message: string;
  status: string;
};

type InboundMessage = {
  timestamp_utc: string;
  from_number: string;
  incoming_body: string;
  intent: string;
  reply: string;
  schedule_follow_up_days: string;
  notes: string;
};

type FollowUp = {
  phone: string;
  owner_name: string;
  last_sent: string;
  days_since_contact: number;
  response_status: 'no_response' | 'replied' | 'needs_followup' | 'not_interested' | 'interested';
  last_response?: string;
  suggested_action: string;
  original_message: string;
};

function parseCSVFile<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as T[];
  } catch {
    return [];
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

function daysBetween(date1: Date, date2: Date): number {
  const diff = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function GET() {
  const sentPath = path.join(toolsDir, 'sent_campaigns.csv');
  const inboundPath = path.join(toolsDir, 'inbound_log.csv');

  const sentCampaigns = parseCSVFile<SentCampaign>(sentPath);
  const inboundMessages = parseCSVFile<InboundMessage>(inboundPath);

  if (sentCampaigns.length === 0) {
    return NextResponse.json({
      ok: true,
      followups: [],
      stats: { total: 0, no_response: 0, needs_followup: 0, replied: 0 },
      message: 'No campaigns sent yet. Send campaigns first from the Campaigns page.',
    });
  }

  // Group sent campaigns by phone (get latest per phone)
  const sentByPhone = new Map<string, SentCampaign>();
  for (const sent of sentCampaigns) {
    if (sent.status === 'sent') {
      const normalized = normalizePhone(sent.phone);
      const existing = sentByPhone.get(normalized);
      if (!existing || new Date(sent.timestamp) > new Date(existing.timestamp)) {
        sentByPhone.set(normalized, sent);
      }
    }
  }

  // Group inbound messages by phone
  const responsesByPhone = new Map<string, InboundMessage[]>();
  for (const msg of inboundMessages) {
    const normalized = normalizePhone(msg.from_number);
    if (!responsesByPhone.has(normalized)) {
      responsesByPhone.set(normalized, []);
    }
    responsesByPhone.get(normalized)!.push(msg);
  }

  const now = new Date();
  const followups: FollowUp[] = [];

  for (const [normalizedPhone, sent] of sentByPhone) {
    const responses = responsesByPhone.get(normalizedPhone) || [];
    const sentDate = new Date(sent.timestamp);
    const daysSince = daysBetween(sentDate, now);

    // Get latest response after send
    const responsesAfterSend = responses.filter(
      r => new Date(r.timestamp_utc) > sentDate
    ).sort((a, b) =>
      new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime()
    );

    const latestResponse = responsesAfterSend[0];

    let responseStatus: FollowUp['response_status'] = 'no_response';
    let suggestedAction = '';

    if (latestResponse) {
      const intent = (latestResponse.intent || '').toLowerCase();
      const followupDays = latestResponse.schedule_follow_up_days;

      if (intent.includes('not interested') || intent.includes('stop')) {
        responseStatus = 'not_interested';
        suggestedAction = 'Remove from follow-up list';
      } else if (intent.includes('interested') || intent.includes('yes')) {
        responseStatus = 'interested';
        suggestedAction = 'Schedule a call or meeting';
      } else if (followupDays && parseInt(followupDays) > 0) {
        responseStatus = 'needs_followup';
        suggestedAction = `Follow up in ${followupDays} days`;
      } else {
        responseStatus = 'replied';
        suggestedAction = 'Review conversation and respond';
      }
    } else {
      // No response - suggest follow-up based on days since contact
      if (daysSince >= 7) {
        suggestedAction = 'Send 7-day follow-up (final check-in)';
      } else if (daysSince >= 3) {
        suggestedAction = 'Send 3-day follow-up (gentle reminder)';
      } else if (daysSince >= 1) {
        suggestedAction = 'Send 1-day follow-up (quick check-in)';
      } else {
        suggestedAction = 'Wait - contacted today';
      }
    }

    // Only include leads that need follow-up action
    if (responseStatus === 'no_response' || responseStatus === 'needs_followup' || responseStatus === 'replied') {
      followups.push({
        phone: sent.phone,
        owner_name: sent.owner_name,
        last_sent: sent.timestamp,
        days_since_contact: daysSince,
        response_status: responseStatus,
        last_response: latestResponse?.incoming_body,
        suggested_action: suggestedAction,
        original_message: sent.message,
      });
    }
  }

  // Sort by priority: no_response first, then by days since contact
  followups.sort((a, b) => {
    if (a.response_status === 'no_response' && b.response_status !== 'no_response') return -1;
    if (b.response_status === 'no_response' && a.response_status !== 'no_response') return 1;
    return b.days_since_contact - a.days_since_contact;
  });

  const stats = {
    total: followups.length,
    no_response: followups.filter(f => f.response_status === 'no_response').length,
    needs_followup: followups.filter(f => f.response_status === 'needs_followup').length,
    replied: followups.filter(f => f.response_status === 'replied').length,
  };

  return NextResponse.json({
    ok: true,
    followups,
    stats,
  });
}
