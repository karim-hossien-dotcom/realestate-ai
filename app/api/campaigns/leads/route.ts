import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const toolsDir =
  process.env.TOOLS_DIR || path.join(process.cwd(), 'tools');

type Lead = {
  owner_name: string;
  phone: string;
  property_address: string;
  sms_text: string;
  email: string;
};

function parseCSV(content: string): Lead[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  const ownerIdx = headers.findIndex((h) => h === 'owner_name' || h === 'owner name');
  const phoneIdx = headers.findIndex((h) => h === 'phone');
  const addressIdx = headers.findIndex((h) => h === 'property_address' || h === 'property address');
  const smsIdx = headers.findIndex((h) => h === 'sms_text' || h === 'sms text');
  const emailIdx = headers.findIndex((h) => h === 'email');

  const leads: Lead[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const lead: Lead = {
      owner_name: ownerIdx >= 0 ? (values[ownerIdx] || '').trim() : '',
      phone: phoneIdx >= 0 ? (values[phoneIdx] || '').trim() : '',
      property_address: addressIdx >= 0 ? (values[addressIdx] || '').trim() : '',
      sms_text: smsIdx >= 0 ? (values[smsIdx] || '').trim() : '',
      email: emailIdx >= 0 ? (values[emailIdx] || '').trim() : '',
    };
    if (lead.phone || lead.owner_name) {
      leads.push(lead);
    }
  }

  return leads;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

export async function GET() {
  const fullPath = path.join(toolsDir, 'output_full.csv');
  const basicPath = path.join(toolsDir, 'output.csv');

  let csvPath: string | null = null;

  if (fs.existsSync(fullPath)) {
    csvPath = fullPath;
  } else if (fs.existsSync(basicPath)) {
    csvPath = basicPath;
  }

  if (!csvPath) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No leads output found. Run Generate on the Leads page first.',
        leads: [],
      },
      { status: 404 }
    );
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const leads = parseCSV(content);

  return NextResponse.json({
    ok: true,
    source: path.basename(csvPath),
    leads,
  });
}
