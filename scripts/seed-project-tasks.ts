/**
 * Seed script — populates project_tasks table with all department tasks.
 *
 * Run:  npx tsx scripts/seed-project-tasks.ts
 *
 * Uses the SUPABASE_SERVICE_ROLE_KEY so it bypasses RLS.
 * Pass USER_ID env var or it defaults to the first profile found.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface TaskSeed {
  department: string
  priority: string
  title: string
  description?: string
  channel?: string
  is_blocker?: boolean
  is_automatable?: boolean
  week_label?: string
  metric_threshold?: string
  metric_current?: string
  alert_status?: string
  vendor_name?: string
  vendor_service?: string
  vendor_plan?: string
  vendor_action?: string
}

const TASKS: TaskSeed[] = [
  // ── LEGAL ──
  { department: 'legal', priority: 'P0', title: 'Complete A2P 10DLC brand + campaign registration', description: 'Blocks SMS at scale — follow up with Twilio support', channel: 'SMS', is_blocker: true, is_automatable: false },
  { department: 'legal', priority: 'P0', title: 'Add email unsubscribe links to all marketing emails', description: 'CAN-SPAM violation — build unsubscribe endpoint. DONE: /api/email/unsubscribe endpoint + clickable links in all email templates + physical address footer.', channel: 'Email', is_blocker: true, is_automatable: false },
  { department: 'legal', priority: 'P0', title: 'Add full physical street address to Terms & emails', description: 'Updated to 700 1st St, Hoboken, NJ 07030 in Terms, Privacy Policy, and all email footers.', channel: 'All', is_blocker: true, is_automatable: false },
  { department: 'legal', priority: 'P0', title: 'Implement National DNC Registry scrubbing', description: 'Built dnc-registry.ts + national_dnc table + integrated into campaigns/send and cron/send-followups. Next: register at FTC site and load data.', channel: 'SMS', is_blocker: true, is_automatable: false },
  { department: 'legal', priority: 'P1', title: 'Add AI disclosure to auto-reply messages', description: 'Some jurisdictions require chatbot disclosure', channel: 'WhatsApp', is_blocker: false, is_automatable: true },
  { department: 'legal', priority: 'P1', title: 'Update Privacy Policy with CCPA section', description: 'Right to know, delete, opt-out of sale', channel: 'All', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P1', title: 'Draft full SaaS Terms of Service', description: 'Need liability limits, warranty, indemnification', channel: 'All', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P1', title: 'Finalize DPA template for agency customers', description: 'B2B requirement — template in Legal Pack', channel: 'All', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P2', title: 'Add GDPR section to Privacy Policy', description: 'Only if EU users expected', channel: 'All', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P2', title: 'Implement CASL consent flow for Canadian users', description: 'Express consent required for CA', channel: 'Email', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P2', title: 'Obtain E&O and cyber liability insurance', description: 'Risk mitigation', channel: 'All', is_blocker: false, is_automatable: false },
  { department: 'legal', priority: 'P2', title: 'Document broker compliance by state', description: 'RE-specific regulations vary', channel: 'All', is_blocker: false, is_automatable: false },

  // ── ENGINEERING ──
  { department: 'engineering', priority: 'P0', title: 'Add /health endpoint to Node.js service', description: 'DONE: /api/health — checks Supabase DB connectivity + env vars, returns healthy/degraded + latency.', is_automatable: true },
  { department: 'engineering', priority: 'P0', title: 'Add /health endpoint to Python webhook', description: 'DONE: Enhanced /health — checks Supabase, OpenAI key, WhatsApp token. Returns JSON with status codes.', is_automatable: true },
  { department: 'engineering', priority: 'P0', title: 'Set up Render monitoring dashboard', description: 'Health endpoints ready. Set Health Check Path to /api/health (Node) and /health (Python) in Render settings.', is_automatable: false },
  { department: 'engineering', priority: 'P0', title: 'Configure Supabase dashboard alerts', description: 'DB connections, query perf', is_automatable: false },
  { department: 'engineering', priority: 'P1', title: 'Implement feature usage analytics', description: 'Track per feature in activity_logs', is_automatable: true },
  { department: 'engineering', priority: 'P1', title: 'Build weekly AI audit workflow', description: 'Sample 50 conversations, score 1-5', is_automatable: false },
  { department: 'engineering', priority: 'P1', title: 'Add error alerting (Slack/email on 5xx)', description: 'Render webhook or custom cron', is_automatable: true },
  { department: 'engineering', priority: 'P1', title: 'In-app NPS survey / feedback widget', description: 'Trigger after 7 days', is_automatable: true },
  { department: 'engineering', priority: 'P2', title: 'Message delivery rate tracking', description: 'Aggregate from messages table', is_automatable: true },
  { department: 'engineering', priority: 'P2', title: 'Webhook delivery monitoring', description: 'Compare logs vs received', is_automatable: true },
  { department: 'engineering', priority: 'P2', title: 'Monthly UX review process', description: 'Walk all 8 pages', is_automatable: false },
  { department: 'engineering', priority: 'P3', title: 'API response time baselines', description: 'P50/P95/P99 for 32 routes', is_automatable: true },
  { department: 'engineering', priority: 'P3', title: 'Expand test suite (3 → 10+ files)', description: 'Stripe, WhatsApp, campaign', is_automatable: true },

  // ── MARKETING ──
  { department: 'marketing', priority: 'P1', title: 'Set up Facebook Business Manager', week_label: 'W1', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Set up Google Ads + keyword research', week_label: 'W1', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Create LinkedIn company page', week_label: 'W1', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Record product demo video (2-3 min)', week_label: 'W1-2', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Design 3-5 ad creatives (FB/IG)', week_label: 'W2', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Build landing page A/B variants', week_label: 'W2', is_automatable: true },
  { department: 'marketing', priority: 'P1', title: 'Write 4 LinkedIn thought leadership posts', week_label: 'W2-3', is_automatable: true },
  { department: 'marketing', priority: 'P1', title: 'Launch Facebook/IG ad campaign', week_label: 'W3', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Launch Google Ads search campaign', week_label: 'W3', is_automatable: false },
  { department: 'marketing', priority: 'P2', title: 'Join 10 RE Facebook groups', week_label: 'W3-4', is_automatable: false },
  { department: 'marketing', priority: 'P1', title: 'Email outreach to 100 brokerages', week_label: 'W4', is_automatable: true },
  { department: 'marketing', priority: 'P2', title: 'Collect 3 beta user testimonials', week_label: 'W4', is_automatable: false },

  // ── FINANCE — Cost Alerts ──
  { department: 'finance', priority: 'P1', title: 'Monthly Burn tracking', metric_threshold: '$2,000/mo', metric_current: '~$14/mo', alert_status: 'ok', description: 'Render only' },
  { department: 'finance', priority: 'P1', title: 'Render Hosting costs', metric_threshold: '$50/mo', metric_current: '~$14/mo', alert_status: 'ok', description: 'Upgrade at ~50 users', vendor_name: 'Render', vendor_service: 'Node + Python', vendor_plan: 'Starter $14/mo', vendor_action: 'Upgrade ~50 users' },
  { department: 'finance', priority: 'P1', title: 'Supabase costs', metric_threshold: '$25/mo', metric_current: '$0', alert_status: 'ok', description: 'Free tier', vendor_name: 'Supabase', vendor_service: 'Database + Auth', vendor_plan: 'Free tier', vendor_action: 'Upgrade at 500MB' },
  { department: 'finance', priority: 'P1', title: 'OpenAI API costs', metric_threshold: '$0.03/conv', metric_current: 'Variable', alert_status: 'watch', description: 'Monitor per-user', vendor_name: 'OpenAI', vendor_service: 'GPT-4o API', vendor_plan: 'Pay-as-you-go', vendor_action: 'Test GPT-4o-mini' },
  { department: 'finance', priority: 'P1', title: 'WhatsApp messaging costs', metric_threshold: '$0.065/conv', metric_current: 'Variable', alert_status: 'watch', description: 'Meta utility rate', vendor_name: 'Meta', vendor_service: 'WhatsApp API', vendor_plan: '$0.065/conv', vendor_action: 'Optimize templates' },
  { department: 'finance', priority: 'P1', title: 'Twilio SMS costs', metric_threshold: '$0.0079/seg', metric_current: 'Variable', alert_status: 'watch', description: 'Complete 10DLC', vendor_name: 'Twilio', vendor_service: 'SMS (10DLC pending)', vendor_plan: '$0.0079/seg', vendor_action: 'Complete 10DLC' },
  { department: 'finance', priority: 'P2', title: 'Stripe processing fees', metric_threshold: '2.9% + $0.30', metric_current: 'Standard', alert_status: 'ok', description: 'No discount <$1M', vendor_name: 'Stripe', vendor_service: 'Payments', vendor_plan: '2.9% + $0.30', vendor_action: 'Standard pricing' },
  { department: 'finance', priority: 'P1', title: 'CAC target tracking', metric_threshold: '< $150', metric_current: '—', alert_status: 'watch', description: 'Track post-launch' },
  { department: 'finance', priority: 'P1', title: 'LTV:CAC ratio', metric_threshold: '> 3.0x', metric_current: '—', alert_status: 'watch', description: 'Needs 3+ months' },
  { department: 'finance', priority: 'P2', title: 'Gross margin', metric_threshold: '> 70%', metric_current: '—', alert_status: 'ok', description: 'SaaS margins high' },
  { department: 'finance', priority: 'P2', title: 'Resend email costs', vendor_name: 'Resend', vendor_service: 'Email', vendor_plan: 'Free (100/day)', vendor_action: 'Upgrade at 100/day', description: 'Free tier currently' },
]

async function seed() {
  // Resolve user ID
  let userId = process.env.USER_ID

  if (!userId) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single()

    if (!profiles) {
      console.error('No user found. Set USER_ID env var or create a user first.')
      process.exit(1)
    }
    userId = profiles.id
  }

  console.log(`Seeding ${TASKS.length} tasks for user ${userId}...`)

  // Clear existing tasks for this user
  const { error: deleteErr } = await supabase
    .from('project_tasks')
    .delete()
    .eq('user_id', userId)

  if (deleteErr) {
    console.error('Failed to clear existing tasks:', deleteErr.message)
  }

  // Tasks completed by Claude Code in this session
  const COMPLETED_TITLES = new Set([
    'Add email unsubscribe links to all marketing emails',
    'Add full physical street address to Terms & emails',
    'Implement National DNC Registry scrubbing',
    'Add /health endpoint to Node.js service',
    'Add /health endpoint to Python webhook',
    'Set up Render monitoring dashboard',
  ])

  // Insert all tasks
  const now = new Date().toISOString()
  const rows = TASKS.map(t => ({
    user_id: userId,
    status: COMPLETED_TITLES.has(t.title) ? 'completed' : 'pending',
    ...(COMPLETED_TITLES.has(t.title) ? {
      completed_at: now,
      completed_by: 'claude_code',
      completion_note: 'Implemented in Mar 10 session',
    } : {}),
    ...t,
  }))

  const { data, error } = await supabase
    .from('project_tasks')
    .insert(rows)
    .select('id, department, title')

  if (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }

  console.log(`Seeded ${data.length} tasks:`)
  const counts: Record<string, number> = {}
  for (const t of data) {
    counts[t.department] = (counts[t.department] || 0) + 1
  }
  for (const [dept, count] of Object.entries(counts)) {
    console.log(`  ${dept}: ${count}`)
  }
  console.log('\nDone!')
}

seed().catch(console.error)
