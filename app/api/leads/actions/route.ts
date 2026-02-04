import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFile = path.join(process.cwd(), 'tools', 'leads_data.json');

type LeadData = {
  phone: string;
  meetings?: Array<{ date: string; time: string; note?: string; createdAt: string }>;
  followUps?: Array<{ dueDate: string; note?: string; createdAt: string }>;
  tags?: string[];
  notes?: string;
};

type LeadsStore = Record<string, LeadData>;

function loadData(): LeadsStore {
  if (!fs.existsSync(dataFile)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch {
    return {};
  }
}

function saveData(data: LeadsStore) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');

  const data = loadData();

  if (phone) {
    return NextResponse.json({ ok: true, data: data[phone] || null });
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || !body.phone || !body.action) {
    return NextResponse.json(
      { ok: false, error: 'Missing phone or action' },
      { status: 400 }
    );
  }

  const { phone, action } = body;
  const data = loadData();

  if (!data[phone]) {
    data[phone] = { phone };
  }

  const lead = data[phone];
  const now = new Date().toISOString();

  switch (action) {
    case 'schedule_meeting': {
      const { date, time, note } = body;
      if (!date || !time) {
        return NextResponse.json(
          { ok: false, error: 'Missing date or time' },
          { status: 400 }
        );
      }
      if (!lead.meetings) lead.meetings = [];
      lead.meetings.push({ date, time, note, createdAt: now });
      break;
    }

    case 'add_followup': {
      const { dueDate, note } = body;
      if (!dueDate) {
        return NextResponse.json(
          { ok: false, error: 'Missing dueDate' },
          { status: 400 }
        );
      }
      if (!lead.followUps) lead.followUps = [];
      lead.followUps.push({ dueDate, note, createdAt: now });
      break;
    }

    case 'update_tags': {
      const { tags } = body;
      if (!Array.isArray(tags)) {
        return NextResponse.json(
          { ok: false, error: 'Tags must be an array' },
          { status: 400 }
        );
      }
      lead.tags = tags;
      break;
    }

    case 'save_notes': {
      const { notes } = body;
      lead.notes = notes || '';
      break;
    }

    default:
      return NextResponse.json(
        { ok: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
  }

  data[phone] = lead;
  saveData(data);

  return NextResponse.json({ ok: true, data: lead });
}
