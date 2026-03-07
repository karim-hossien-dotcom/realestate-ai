import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

const TEST_LEADS = [
  {
    owner_name: 'Ahmad Hassan',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '123 Main St, Newark NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 65,
    score_category: 'Warm',
    tags: ['wa-test', 'uc1-cold-outreach'],
    sms_text:
      'I noticed your property at 123 Main St and wanted to reach out. The commercial market in Newark has been very active, and I have buyers looking in your area. Would you be open to a quick conversation about your property\'s current market value?',
    notes: 'UC1: Cold outreach — verify delivery only',
  },
  {
    owner_name: 'Sarah Mitchell',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '456 Oak Ave, Jersey City NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 72,
    score_category: 'Warm',
    tags: ['wa-test', 'uc2-interested-seller'],
    sms_text:
      "I've been working with investors eyeing properties on Oak Ave in Jersey City. Your property at 456 caught my attention. Would you consider discussing its value over a quick call this week?",
    notes: 'UC2: Interested seller — reply to trigger qualification',
  },
  {
    owner_name: 'James Wilson',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '789 Elm Dr, Hoboken NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 50,
    score_category: 'Warm',
    tags: ['wa-test', 'uc3-not-interested'],
    sms_text:
      'Hi James, properties like yours at 789 Elm Dr are in high demand in Hoboken right now. I\'d love to share what similar properties have been going for. Would you be open to a brief chat?',
    notes: 'UC3: Not interested — test graceful close',
  },
  {
    owner_name: 'Maria Garcia',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '321 Pine Rd, Bayonne NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 55,
    score_category: 'Warm',
    tags: ['wa-test', 'uc4-stop-dnc'],
    sms_text:
      'Hi Maria, I\'m reaching out about your property at 321 Pine Rd. The Bayonne market has seen strong activity lately. Would you be interested in a free market analysis?',
    notes: 'UC4: STOP / DNC compliance test',
  },
  {
    owner_name: 'David Chen',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '555 Broadway, Paterson NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 80,
    score_category: 'Hot',
    tags: ['wa-test', 'uc5-meeting-booking'],
    sms_text:
      'Hi David, your property at 555 Broadway caught my eye. I work with serious buyers looking for commercial space in Paterson. Would you be open to discussing your plans for the property?',
    notes: 'UC5: Full qualification → meeting booking (multi-turn)',
  },
  {
    owner_name: 'Robert Kim',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '777 River Rd, Edgewater NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 45,
    score_category: 'Warm',
    tags: ['wa-test', 'uc6-escalation'],
    sms_text:
      'Hi Robert, I noticed your property at 777 River Rd and wanted to connect. Edgewater waterfront properties are highly sought after. Would you consider a quick conversation?',
    notes: 'UC6: Escalation — angry/legal response test',
  },
  {
    owner_name: 'Linda Park',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '999 Harbor Blvd, Weehawken NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 70,
    score_category: 'Warm',
    tags: ['wa-test', 'uc7-buyer-lead'],
    sms_text:
      'Hi Linda, your property at 999 Harbor Blvd is in a prime Weehawken location. I have active buyers interested in the area. Would you be open to hearing what the market looks like?',
    notes: 'UC7: Buyer lead — wants to buy, not sell',
  },
  {
    owner_name: 'Omar Farouq',
    phone: '+13474452049',
    email: 'karim@test.com',
    property_address: '222 Bergen Ave, Kearny NJ',
    property_type: 'commercial',
    status: 'new',
    contact_preference: 'whatsapp',
    score: 60,
    score_category: 'Warm',
    tags: ['wa-test', 'uc8-arabic'],
    sms_text:
      "Hi Omar, I'm reaching out about your property at 222 Bergen Ave. The Kearny market has been heating up, and I'd love to share some insights. Would you be open to a brief conversation?",
    notes: 'UC8: Arabic reply — multilingual AI test',
  },
]

export async function POST(request: Request) {
  // Auth: require CRON_SECRET
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Get the first user to associate leads with
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: false, error: 'No user profiles found. Sign up first.' }, { status: 400 })
  }

  const userId = profiles[0].id

  // Clean up existing test leads (idempotent)
  await supabase
    .from('leads')
    .delete()
    .contains('tags', ['wa-test'])
    .eq('user_id', userId)

  // Insert test leads
  const leadsToInsert = TEST_LEADS.map((lead) => ({
    ...lead,
    user_id: userId,
    email_text: lead.sms_text,
  }))

  const { data: created, error } = await supabase
    .from('leads')
    .insert(leadsToInsert)
    .select('id, owner_name, property_address, tags')

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    created: created?.length || 0,
    userId,
    leads: created,
  })
}
