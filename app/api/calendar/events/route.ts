import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const leadsDataFile = path.join(process.cwd(), 'tools', 'leads_data.json');

type Meeting = {
  date: string;
  time: string;
  note?: string;
  createdAt: string;
};

type FollowUp = {
  dueDate: string;
  note?: string;
  createdAt: string;
};

type LeadData = {
  phone: string;
  meetings?: Meeting[];
  followUps?: FollowUp[];
  tags?: string[];
  notes?: string;
};

type LeadsStore = Record<string, LeadData>;

type CalendarEvent = {
  id: string;
  type: 'meeting' | 'followup';
  date: string;
  time?: string;
  title: string;
  phone: string;
  note?: string;
};

function loadLeadsData(): LeadsStore {
  if (!fs.existsSync(leadsDataFile)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(leadsDataFile, 'utf-8'));
  } catch {
    return {};
  }
}

export async function GET() {
  const leadsData = loadLeadsData();
  const events: CalendarEvent[] = [];

  for (const [phone, lead] of Object.entries(leadsData)) {
    // Add meetings
    if (lead.meetings) {
      lead.meetings.forEach((meeting, idx) => {
        events.push({
          id: `meeting-${phone}-${idx}`,
          type: 'meeting',
          date: meeting.date,
          time: meeting.time,
          title: `Meeting: ${phone}`,
          phone,
          note: meeting.note,
        });
      });
    }

    // Add follow-ups
    if (lead.followUps) {
      lead.followUps.forEach((followUp, idx) => {
        events.push({
          id: `followup-${phone}-${idx}`,
          type: 'followup',
          date: followUp.dueDate,
          title: `Follow-up: ${phone}`,
          phone,
          note: followUp.note,
        });
      });
    }
  }

  // Sort by date
  events.sort((a, b) => {
    const dateA = new Date(a.date + (a.time ? `T${a.time}` : ''));
    const dateB = new Date(b.date + (b.time ? `T${b.time}` : ''));
    return dateA.getTime() - dateB.getTime();
  });

  return NextResponse.json({ ok: true, events });
}
