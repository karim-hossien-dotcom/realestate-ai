# Estate AI — CLAUDE.md

## Project Purpose
AI-powered real estate CRM that automates lead outreach, follow-ups, and conversation management across WhatsApp, SMS, and Email. Built for EYWA Consulting Services Inc. First client: Nadine Khalil / KW Commercial.

## Tech Stack
- **Framework:** Next.js 16 App Router + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Database/Auth:** Supabase (18+ tables, RLS enabled on all)
- **AI:** OpenAI GPT-4o-mini (lead scoring, follow-up generation, inbound agent)
- **Messaging:** Meta WhatsApp Business API v21.0 + Twilio SMS + Resend Email
- **Payments:** Stripe (3 tiers: Starter $99, Pro $249, Agency $499)
- **Python Backend:** Flask webhook server (WhatsApp/SMS inbound, AI agent)
- **Deployment:** Render (Node.js + Python services)
- **Domain:** realestate-ai.app
- **Testing:** Vitest

## Architecture
```
app/
  api/              -> 60 API routes (Next.js Route Handlers)
  components/       -> 17 React components (inc. admin/ subdir)
  lib/
    ai/             -> Lead scorer, follow-up generator, listing agent, prompt builder
    billing/        -> stripe.ts, overage.ts, usage.ts, feature-gate.ts
    messaging/      -> whatsapp.ts, sms.ts, email.ts, outreach-messages.ts, dnc-registry.ts
    supabase/       -> Database clients (browser, server, middleware, types)
    integrations/   -> Follow-Up Boss CRM
    auth.ts         -> withAuth() + logActivity()
    api.ts          -> parseBody(), success(), error(), checkPhoneTaken()
    schemas.ts      -> Zod schemas for all API validation
    csv-mapper.ts   -> CSV import field mapping
    maps.ts         -> Google Maps integration
    system-checks.ts-> Service health checks
    ai-audit.ts     -> AI audit utilities
  (app)/            -> 14 pages (dashboard, leads, campaigns, conversations, etc.)
tools/              -> Python backend (Flask webhooks, AI agents)
scripts/            -> Migration scripts
planning/           -> PLAN.md, task_plan.md, progress.md, findings.md
supabase/           -> Schema + 16 migrations
__tests__/          -> 3 test files (Vitest)
middleware.ts       -> Supabase session management
```

## Coding Conventions
- TypeScript strict mode — no `any` types
- Path alias: `@/*` maps to project root
- Auth: Every API route must call `withAuth()` first (except health, webhooks, cron)
- Activity logging: Use `logActivity()` for audit trail
- Input validation: Use Zod schemas at API boundaries (defined in `app/lib/schemas.ts`)
- API responses: Use `{ ok, ...data }` envelope — return properties flat at the top level, not nested under `data`
- Body parsing: Use `parseBody(request, schema)` from `app/lib/api.ts`
- Immutability: Create new objects, never mutate existing ones
- File size: Keep under 400 lines (800 max)
- Functions: Keep under 50 lines
- Error handling: Explicit try/catch on every API route, log with context

## Database Tables (23)
profiles, leads, messages, campaigns, campaign_leads, follow_ups,
plans, subscriptions, usage_records, activity_logs, dnc_list,
consent_records, crm_connections, research_findings, daily_reports,
ai_config, nps_responses, ai_audits, project_tasks, meetings,
custom_templates, system_alerts, ai_improvements

## Key Patterns

### Authentication
```typescript
const auth = await withAuth()
if (!auth.ok) return auth.response
// auth.user.id and auth.user.email are now available
```

### Supabase Client Selection
- **API routes (authenticated):** `await createClient()` — respects RLS via cookies
- **Webhooks/cron (service context):** `createServiceClient()` — bypasses RLS
- **Browser components:** `createBrowserClient()` from `app/lib/supabase/client.ts`

### Usage & Billing
- All messaging channels share ONE pool (counted against `included_sms`)
- Subscribed users are always `allowed: true` — overages are billed, never blocked
- No subscription = `allowed: false`
- Admin bypass: hardcoded `ADMIN_USER_ID` in usage.ts and feature-gate.ts
- Feature gating: Starter < Pro < Agency tier system in `feature-gate.ts`
- Overage recording: `recordOverage()` after every send when `isOverage: true`

### Messaging Flow
All messaging goes through API routes — never call WhatsApp/Twilio/Resend directly from client:
1. Check `withAuth()` -> Check usage quota -> Check DNC list -> Send message
2. Record overage if over quota -> Log message to DB -> Update lead last_contacted -> Log activity

### Python Webhook
- Flask + gunicorn, deduplicates messages with LRU cache
- 8-second debounce for rapid-fire WhatsApp messages (multi-texter support)
- STOP messages bypass debounce (immediate processing)
- Phone lookups use `like()` with digits-only (not `or_()`) due to Supabase SDK encoding bug
- `get_conversation_history()` searches by BOTH lead_id AND phone number

### Lead Scoring
0-100 algorithm: response +30, intent +25, engagement +15, completeness +5, decay -1/day

### Data Pipeline (Dashboard / Admin / Daily Ops)
```
Data Sources (live DB)         Cron Pipeline              Consumers
─────────────────────         ──────────────              ─────────
leads, messages,         →    /api/cron/daily-ops    →    Admin Daily Digest
campaigns, follow_ups         (writes daily_reports)      (reads daily_reports)
subscriptions, plans
activity_logs            →    /api/cron/check-alerts →    Email to ADMIN if critical
usage_records                 (runs system-checks.ts)

leads, messages,         →    (direct queries)       →    User Dashboard (/dashboard)
campaigns, follow_ups         via /api/analytics/         (user-scoped, live)
                              dashboard

project_tasks            →    (live CRUD)            →    Admin Tasks tab
                              via /api/tasks              (real-time, not from markdown)
```

**Important distinctions:**
- `planning/PLAN.md` and `planning/task_plan.md` are **static docs for Claude sessions** — they do NOT feed the admin UI
- The admin panel reads from `project_tasks` and `daily_reports` **DB tables**
- `daily_reports`: written by `/api/cron/daily-ops` (1x/day), one row per department per day
- Revenue chart in admin is connected to `/api/admin/revenue` — real MRR from subscriptions (fixed Mar 16)
- Daily reports findings do NOT auto-create `project_tasks` — manual linking only

## Danger Zones

**NEVER modify these files without explicit confirmation. Changes can break billing, messaging, or data integrity.**

| File | Risk | Why |
|------|------|-----|
| `app/api/stripe/webhook/route.ts` | CRITICAL | All billing state. No withAuth() by design. Wrong changes = lost revenue. |
| `tools/webhook_app.py` | CRITICAL | All inbound WhatsApp/SMS. Debounce, DNC, AI routing. Break = lose conversations. |
| `tools/db.py` | HIGH | Python-Supabase bridge. Phone normalization bugs cause invisible messages. |
| `app/lib/usage.ts` | HIGH | Controls who can send. Bug = block paying users or allow unlimited free. |
| `app/lib/overage.ts` | HIGH | Overage billing. Race conditions lose revenue. |
| `app/lib/feature-gate.ts` | HIGH | Plan-based feature access. Wrong change = free features or blocked users. |
| `middleware.ts` | MEDIUM | Session management. Affects auth across entire app. |
| `app/lib/auth.ts` | MEDIUM | Core auth helper. Every API route depends on it. |

## Environment Variables
See `.env.example` for full list. Critical:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `CRON_SECRET` (protects cron routes)

## Testing
- Framework: Vitest
- Run: `npm test`
- Coverage: `npm run test:coverage`
- Tests live in `__tests__/` directory
- Current: 3 test files (api-helpers, lead-scorer, schemas)
- Test critical paths: Stripe webhook, WhatsApp webhook, lead scoring, API validation

## Skills Reference

### Project Skills (`.claude/skills/`)
| Skill | Command | When to Use |
|-------|---------|-------------|
| daily-ops | `/daily-ops:run` | Run all 5 department checks in sequence |
| daily-ops | `/daily-ops:status` | Quick health dashboard across departments |
| engineering-ops | `/engineering-ops:health` | Check Node.js + Python service health |
| engineering-ops | `/engineering-ops:tests` | Run test suite and analyze coverage |
| engineering-ops | `/engineering-ops:audit` | Find oversized files, missing auth, hardcoded values |
| finance-ops | `/finance-ops:costs` | Analyze vendor costs and project expenses |
| finance-ops | `/finance-ops:revenue` | Track MRR, subscriber growth, ARPU |
| finance-ops | `/finance-ops:margins` | Calculate gross margins per plan tier |
| legal-ops | `/legal-ops:compliance` | TCPA, CAN-SPAM, CCPA audit |
| legal-ops | `/legal-ops:dnc` | Audit DNC enforcement across all channels |
| market-research | `/market-research:competitors` | Competitor pricing and feature comparison |
| market-research | `/market-research:gaps` | Feature gaps vs competitors |
| marketing-ops | `/marketing-ops:content` | Draft LinkedIn posts, emails, blog outlines |
| marketing-ops | `/marketing-ops:landing-page` | Audit landing page SEO and conversion |
| ui-ux-pro-max | (auto-triggered) | Design intelligence for any UI work |

### Plugin Skills (marketplace-installed)
| Plugin | Key Skills | When to Use |
|--------|-----------|-------------|
| superpowers | brainstorming, TDD, debugging, writing-plans, code-review, verification | Feature work, bug fixes, planning |
| document-skills | pdf, pptx, xlsx, docx, frontend-design | Document creation, spreadsheet work |
| planning-with-files | plan, status | Complex multi-step task tracking |
| frontend-design | frontend-design | UI component and page creation |

## Agents Reference (`~/.claude/agents/`)
| Agent | When to Invoke |
|-------|---------------|
| planner | Complex features needing deep codebase exploration |
| architect | System design decisions, new integrations |
| tdd-guide | New features or bug fixes (write tests first) |
| code-reviewer | After writing code, before committing |
| security-reviewer | Before commits touching auth, payments, user data |
| build-error-resolver | When `npm run build` fails |
| e2e-runner | Testing critical user flows end-to-end |
| refactor-cleaner | Dead code cleanup, file splitting |
| doc-updater | Updating documentation after changes |
| ai-improver | Analyzing AI conversation quality, proposing prompt improvements |
| engineering-ops | App health monitoring, feature delivery |
| finance-ops | Cost tracking, revenue monitoring |
| legal-ops | Compliance monitoring, policy review |
| market-research-ops | Competitive intelligence, trend analysis |
| marketing-ops | Content strategy, campaign analytics |

## Quick Prompts

### 1. Add a New API Route
```
Create a new API route at app/api/[resource]/route.ts that:
- Uses withAuth() for authentication
- Validates input with a Zod schema in app/lib/schemas.ts
- Uses createClient() for RLS-respecting queries
- Returns { ok: true, ...data } envelope
- Includes try/catch with logActivity() on errors
- Checks usage limits if it sends messages
```

### 2. Fix a Bug in Python Webhook
```
Debug an issue in tools/webhook_app.py:
[describe the symptom]
- Check webhook_app.py for the handler
- Check db.py for any database query issues
- Check phone normalization (must use like() not or_())
- Check conversation history retrieval (both lead_id AND phone)
- Test with Karim's number: +13474452049
- Do NOT modify the debounce logic unless the bug is specifically there
```

### 3. Add a New Gated Feature
```
Add [feature name] gated to [plan tier]:
1. Add feature key to GatedFeature type in app/lib/feature-gate.ts
2. Add minimum plan to FEATURE_MIN_PLAN map
3. Add label to FEATURE_LABELS map
4. In the API route, call checkFeatureAccess() and return 402 if blocked
5. In the UI, check plan and show upgrade prompt if blocked
```

### 4. Run Daily Operations Check
```
/daily-ops:run
```

### 5. Pre-Commit Safety Check
```
Before committing, verify:
1. npm run build — zero errors
2. npm test — all passing
3. No hardcoded secrets in changed files
4. Danger zone files not modified without explicit approval
5. Activity logging added for new operations
6. Zod validation on any new API inputs
```
