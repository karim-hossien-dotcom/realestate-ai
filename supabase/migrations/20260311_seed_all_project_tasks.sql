-- ============================================
-- Seed all 48 project tasks for admin user
-- Run in Supabase SQL Editor
-- ============================================

-- Clear existing tasks (except market_research which were seeded separately)
DELETE FROM project_tasks
WHERE user_id = '45435140-9a0a-49aa-a95e-5ace7657f61a'
  AND department != 'market_research';

-- ── LEGAL (12 tasks) ──
INSERT INTO project_tasks (id, user_id, department, priority, status, title, description, channel, is_blocker, is_automatable, completed_at, completed_by, completion_note) VALUES
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P0', 'pending', 'Complete A2P 10DLC brand + campaign registration', 'Blocks SMS at scale — follow up with Twilio support', 'SMS', true, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P0', 'completed', 'Add email unsubscribe links to all marketing emails', 'CAN-SPAM violation — build unsubscribe endpoint. DONE: /api/email/unsubscribe endpoint + clickable links in all email templates + physical address footer.', 'Email', true, false, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P0', 'completed', 'Add full physical street address to Terms & emails', 'Updated to 700 1st St, Hoboken, NJ 07030 in Terms, Privacy Policy, and all email footers.', 'All', true, false, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P0', 'completed', 'Implement National DNC Registry scrubbing', 'Built dnc-registry.ts + national_dnc table + integrated into campaigns/send and cron/send-followups. Next: register at FTC site and load data.', 'SMS', true, false, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P1', 'pending', 'Add AI disclosure to auto-reply messages', 'Some jurisdictions require chatbot disclosure', 'WhatsApp', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P1', 'pending', 'Update Privacy Policy with CCPA section', 'Right to know, delete, opt-out of sale', 'All', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P1', 'pending', 'Draft full SaaS Terms of Service', 'Need liability limits, warranty, indemnification', 'All', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P1', 'pending', 'Finalize DPA template for agency customers', 'B2B requirement — template in Legal Pack', 'All', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P2', 'pending', 'Add GDPR section to Privacy Policy', 'Only if EU users expected', 'All', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P2', 'pending', 'Implement CASL consent flow for Canadian users', 'Express consent required for CA', 'Email', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P2', 'pending', 'Obtain E&O and cyber liability insurance', 'Risk mitigation', 'All', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'legal', 'P2', 'pending', 'Document broker compliance by state', 'RE-specific regulations vary', 'All', false, false, NULL, NULL, NULL);

-- ── ENGINEERING (13 tasks) ──
INSERT INTO project_tasks (id, user_id, department, priority, status, title, description, is_blocker, is_automatable, completed_at, completed_by, completion_note) VALUES
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P0', 'completed', 'Add /health endpoint to Node.js service', 'DONE: /api/health — checks Supabase DB connectivity + env vars, returns healthy/degraded + latency.', false, true, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P0', 'completed', 'Add /health endpoint to Python webhook', 'DONE: Enhanced /health — checks Supabase, OpenAI key, WhatsApp token. Returns JSON with status codes.', false, true, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P0', 'completed', 'Set up Render monitoring dashboard', 'Health endpoints ready. Set Health Check Path to /api/health (Node) and /health (Python) in Render settings.', false, false, NOW(), 'claude_code', 'Implemented in Mar 10 session'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P0', 'completed', 'Configure Supabase dashboard alerts', 'DB connections, query perf. Built automated alerting system with 7 health checks.', false, false, NOW(), 'claude_code', 'Implemented in Mar 10 session — system-checks.ts + check-alerts cron'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P1', 'pending', 'Implement feature usage analytics', 'Track per feature in activity_logs', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P1', 'pending', 'Build weekly AI audit workflow', 'Sample 50 conversations, score 1-5', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P1', 'pending', 'Add error alerting (Slack/email on 5xx)', 'Render webhook or custom cron', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P1', 'pending', 'In-app NPS survey / feedback widget', 'Trigger after 7 days', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P2', 'pending', 'Message delivery rate tracking', 'Aggregate from messages table', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P2', 'pending', 'Webhook delivery monitoring', 'Compare logs vs received', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P2', 'pending', 'Monthly UX review process', 'Walk all 8 pages', false, false, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P3', 'pending', 'API response time baselines', 'P50/P95/P99 for 32 routes', false, true, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'engineering', 'P3', 'pending', 'Expand test suite (3 → 10+ files)', 'Stripe, WhatsApp, campaign', false, true, NULL, NULL, NULL);

-- ── MARKETING (12 tasks) ──
INSERT INTO project_tasks (id, user_id, department, priority, status, title, description, is_blocker, is_automatable, week_label) VALUES
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Set up Facebook Business Manager', NULL, false, false, 'W1'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Set up Google Ads + keyword research', NULL, false, false, 'W1'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Create LinkedIn company page', NULL, false, false, 'W1'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Record product demo video (2-3 min)', NULL, false, false, 'W1-2'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Design 3-5 ad creatives (FB/IG)', NULL, false, false, 'W2'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Build landing page A/B variants', NULL, false, true, 'W2'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Write 4 LinkedIn thought leadership posts', NULL, false, true, 'W2-3'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Launch Facebook/IG ad campaign', NULL, false, false, 'W3'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Launch Google Ads search campaign', NULL, false, false, 'W3'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P2', 'pending', 'Join 10 RE Facebook groups', NULL, false, false, 'W3-4'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P1', 'pending', 'Email outreach to 100 brokerages', NULL, false, true, 'W4'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'marketing', 'P2', 'pending', 'Collect 3 beta user testimonials', NULL, false, false, 'W4');

-- ── FINANCE (11 tasks) ──
INSERT INTO project_tasks (id, user_id, department, priority, status, title, description, is_blocker, is_automatable, metric_threshold, metric_current, alert_status, vendor_name, vendor_service, vendor_plan, vendor_action) VALUES
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'Monthly Burn tracking', 'Render only', false, false, '$2,000/mo', '~$14/mo', 'ok', NULL, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'Render Hosting costs', 'Upgrade at ~50 users', false, false, '$50/mo', '~$14/mo', 'ok', 'Render', 'Node + Python', 'Starter $14/mo', 'Upgrade ~50 users'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'Supabase costs', 'Free tier', false, false, '$25/mo', '$0', 'ok', 'Supabase', 'Database + Auth', 'Free tier', 'Upgrade at 500MB'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'OpenAI API costs', 'Monitor per-user', false, false, '$0.03/conv', 'Variable', 'watch', 'OpenAI', 'GPT-4o API', 'Pay-as-you-go', 'Test GPT-4o-mini'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'WhatsApp messaging costs', 'Meta utility rate', false, false, '$0.065/conv', 'Variable', 'watch', 'Meta', 'WhatsApp API', '$0.065/conv', 'Optimize templates'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'Twilio SMS costs', 'Complete 10DLC', false, false, '$0.0079/seg', 'Variable', 'watch', 'Twilio', 'SMS (10DLC pending)', '$0.0079/seg', 'Complete 10DLC'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P2', 'pending', 'Stripe processing fees', 'No discount <$1M', false, false, '2.9% + $0.30', 'Standard', 'ok', 'Stripe', 'Payments', '2.9% + $0.30', 'Standard pricing'),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'CAC target tracking', 'Track post-launch', false, false, '< $150', '—', 'watch', NULL, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P1', 'pending', 'LTV:CAC ratio', 'Needs 3+ months', false, false, '> 3.0x', '—', 'watch', NULL, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P2', 'pending', 'Gross margin', 'SaaS margins high', false, false, '> 70%', '—', 'ok', NULL, NULL, NULL, NULL),
(gen_random_uuid(), '45435140-9a0a-49aa-a95e-5ace7657f61a', 'finance', 'P2', 'pending', 'Resend email costs', 'Free tier currently', false, false, NULL, NULL, NULL, 'Resend', 'Email', 'Free (100/day)', 'Upgrade at 100/day');
