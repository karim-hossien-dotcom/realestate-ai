/**
 * One-time script: Backfill lead_id on messages where it is null.
 * Matches by phone number (digits-only in messages vs +E.164 in leads).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Run with:\n  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-lead-id.mjs');
  process.exit(1);
}
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status} ${await res.text()}`);
  return res;
}

function extractDigits(str) {
  if (!str) return null;
  return str.replace(/\D/g, '');
}

async function main() {
  // 1. Get all messages with null lead_id
  const messages = await supaGet('messages?lead_id=is.null&select=id,from_number,to_number,created_at');
  console.log(`Found ${messages.length} messages with null lead_id`);

  if (messages.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  // 2. Get all leads with phone numbers
  const leads = await supaGet('leads?phone=not.is.null&select=id,phone');
  console.log(`Loaded ${leads.length} leads for matching`);

  // Build a map: last 10 digits -> lead_id (for matching)
  const phoneToLead = new Map();
  for (const lead of leads) {
    const digits = extractDigits(lead.phone);
    if (digits) {
      // Store by last 10 digits (US numbers without country code)
      const key = digits.slice(-10);
      phoneToLead.set(key, lead.id);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const msg of messages) {
    // Try from_number first, then to_number
    const phone = msg.from_number || msg.to_number;
    if (!phone) {
      console.log(`  SKIP ${msg.id} — no phone number at all`);
      skipped++;
      continue;
    }

    const digits = extractDigits(phone);
    const key = digits.slice(-10);
    const leadId = phoneToLead.get(key);

    if (!leadId) {
      console.log(`  SKIP ${msg.id} — no lead found for phone ${phone} (digits: ${key})`);
      skipped++;
      continue;
    }

    // 3. Update the message
    await supaPatch(`messages?id=eq.${msg.id}`, { lead_id: leadId });
    console.log(`  UPDATED ${msg.id} -> lead ${leadId} (phone ${phone}, date ${msg.created_at})`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Total: ${messages.length}`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
