# Estate AI — CLAUDE.md

## Project Purpose
AI-powered real estate CRM that automates lead outreach, follow-ups, and conversation management across WhatsApp, SMS, and Email. Built for EYWA Consulting Services Inc.

## Tech Stack
- **Framework:** Next.js 16 App Router + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Database/Auth:** Supabase (13 tables, RLS enabled)
- **AI:** OpenAI GPT-4o (lead scoring, follow-up generation, inbound agent)
- **Messaging:** Meta WhatsApp Business API + Twilio SMS + Resend Email
- **Payments:** Stripe (3 tiers: Starter $99, Pro $249, Agency $499)
- **Python Backend:** Flask webhook server (WhatsApp/SMS inbound)
- **Deployment:** Render (Node.js + Python services)
- **Domain:** realestate-ai.app

## Architecture
```
app/
  api/          → 32 API routes (Next.js Route Handlers)
  components/   → 10 React components
  lib/
    ai/         → Lead scorer, follow-up generator, listing agent
    supabase/   → Database clients (browser + server + middleware)
    integrations/ → Follow-Up Boss CRM
    auth.ts     → withAuth() helper + logActivity()
    whatsapp.ts → Meta Graph API v21.0
    sms.ts      → Twilio
    email.ts    → Resend
    stripe.ts   → Billing
  (app)/        → 8 main app pages (dashboard, leads, campaigns, etc.) — route group, no URL prefix
tools/          → Python backend (Flask webhooks, AI agents)
scripts/        → Migration scripts
supabase/       → Schema + migrations
```

## Coding Conventions
- TypeScript strict mode — no `any` types
- Path alias: `@/*` maps to project root
- Auth: Every API route must call `withAuth()` first
- Activity logging: Use `logActivity()` for audit trail
- Input validation: Use Zod schemas at API boundaries
- API responses: Use `{ ok, ...data }` envelope — return properties flat at the top level, not nested under `data`
- Immutability: Create new objects, never mutate existing ones
- File size: Keep under 400 lines (800 max)
- Functions: Keep under 50 lines
- Error handling: Explicit try/catch on every API route, log with context

## Database Tables (13)
profiles, leads, messages, campaigns, campaign_leads, follow_ups,
plans, subscriptions, usage_records, activity_logs, dnc_list,
consent_records, crm_connections

## Key Patterns
- `withAuth()` returns `{ ok, user }` or `{ ok: false, response }` — check before proceeding
- Supabase server client: `await createClient()` (uses cookies/SSR)
- Python webhook: Flask + gunicorn, deduplicates messages with LRU cache
- Lead scoring: 0-100 algorithm (response +30, intent +25, engagement +15, completeness +5, decay -1/day)
- All messaging goes through API routes — never call WhatsApp/Twilio/Resend directly from client

## Environment Variables
See `.env.example` for full list. Critical:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Testing
- Framework: Vitest
- Run: `npm test`
- Coverage: `npm run test:coverage`
- Tests live in `__tests__/` directory
- Test critical paths: Stripe webhook, WhatsApp webhook, lead scoring, API validation
