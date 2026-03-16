# Estate AI — PLAN.md
> Current state of the codebase as of March 14, 2026

## Fully Built & Working

### Core Platform
- [x] Authentication (Supabase auth + withAuth() + RLS on all 18+ tables)
- [x] Middleware session management
- [x] 51 API routes with consistent error handling
- [x] Zod validation on key input schemas (leads, campaigns, email, whatsapp, stripe, tasks)
- [x] Activity logging + audit trail (`logActivity()` on all operations)

### Lead Management
- [x] Lead CRUD with server-side pagination (50/page)
- [x] CSV import with formula injection protection
- [x] Lead export (user-scoped)
- [x] Lead scoring algorithm (0-100: response, intent, engagement, completeness, decay)
- [x] Bulk delete (batch endpoint, single DB call)
- [x] Cross-user phone dedup checking
- [x] Tags, status management, score categories (hot/warm/cold/dead)

### Multi-Channel Messaging
- [x] WhatsApp (Meta Graph API v21.0) — send text + template messages
- [x] SMS (Twilio REST API, no SDK) — send with demo mode fallback
- [x] Email (Resend SDK) — outreach + follow-up templates with XSS prevention
- [x] Shared messaging pool (all channels count against one quota)
- [x] DNC list enforcement on all channels
- [x] Unsubscribe endpoint for email

### AI Engine (Python)
- [x] Inbound message analysis (GPT-4o-mini) — intent classification, reply generation, lead info extraction
- [x] STOP keyword detection (English + Arabic + Spanish)
- [x] 8-second debounce for rapid-fire WhatsApp messages (multi-texter support)
- [x] Conversation history retrieval (by lead_id + phone number)
- [x] Per-user AI config (custom prompts, introduction templates)
- [x] Natural conversational tone (max 400 chars, anti-repeat rules)
- [x] Commercial property awareness (no bedrooms for commercial)
- [x] Message deduplication (LRU cache for Meta retry handling)

### Billing & Subscriptions
- [x] Stripe Checkout (3 tiers: Starter $99, Pro $249, Agency $499)
- [x] Stripe Customer Portal
- [x] Webhook handling: checkout.completed, invoice.paid, invoice.payment_failed, subscription.updated/deleted, trial_will_end
- [x] Feature gating by plan tier (Starter < Pro < Agency)
- [x] Usage limits with shared pool + overage billing
- [x] Overage line items added to Stripe invoices on `invoice.created`

### Automation
- [x] Follow-up builder (AI-generated follow-up messages)
- [x] Follow-up scheduler + cron sender
- [x] Campaign bulk sending with per-lead DNC checking
- [x] Campaign history persistence + GET endpoint
- [x] Daily operations cron (system checks, alerts)
- [x] Weekly AI audit cron

### Integrations
- [x] Follow-Up Boss CRM (connect, sync, status)
- [x] Calendar with Apple Calendar .ics export
- [x] Google Calendar link generation
- [x] Meeting scheduling with availability checking

### UI Pages (12)
- [x] Login/signup with Supabase auth
- [x] Dashboard with analytics
- [x] Leads (paginated, bulk actions, detail panel)
- [x] Campaigns (send + history)
- [x] Conversations (multi-channel send, 15s polling)
- [x] Follow-ups (view + manage)
- [x] Calendar (meetings, travel gaps, .ics export)
- [x] Settings (profile, billing, CRM, AI script)
- [x] Admin panel (alerts, NPS, AI audit, feature usage)
- [x] Logs (activity timeline)
- [x] Onboarding flow
- [x] Demo page

### Compliance
- [x] Privacy policy (EYWA Consulting Services Inc)
- [x] Cookie consent banner
- [x] STOP/unsubscribe handling across all channels
- [x] DNC list enforcement
- [x] Consent records table
- [x] Email header injection prevention
- [x] CSV formula injection protection
- [x] Font Awesome CDN with SRI hash
- [x] Python webhook rate limiting (60 req/min per IP)

---

## Partially Built

| Item | Status | What's Missing |
|------|--------|---------------|
| Test coverage | 3 files, ~180 lines | Only covers api-helpers, lead-scorer, schemas. 51 API routes untested. Target: 80%+ |
| Settings page tabs | 4 of 8 tabs say "Coming Soon" | Messaging, Email, Team, Auto-Reply tabs are placeholders |
| Admin revenue data | Mock data in `admin/page.tsx` | `revenueData` array is hardcoded, not connected to Stripe |
| Logs page | Basic table view | TODO comment for activity timeline chart + log distribution donut |
| Python logging | 32 print() statements | Should use Python `logging` module for production |

---

## Data Pipeline Alignment

### What feeds the live admin dashboard (DB tables)
| Admin Tab | Data Source | Live? | Written By |
|-----------|------------|-------|------------|
| System Alerts | `runSystemChecks()` + direct DB probes | Real-time | On-demand (user views tab) |
| Daily Digest | `daily_reports` table | Daily | `/api/cron/daily-ops` (Render cron) |
| Project Tasks | `project_tasks` table | Real-time CRUD | Admin UI + Claude Code agents |
| Feature Usage | `activity_logs` table | Near-real-time | All API routes via `logActivity()` |
| NPS Results | `nps_responses` table | Real-time | User submissions |
| AI Audit | `ai_audits` table | Weekly | `/api/cron/weekly-ai-audit` |
| Revenue Chart | **HARDCODED MOCK** | Never | Nobody (static array in admin/page.tsx) |

### What is NOT connected
| Gap | Impact | Fix |
|-----|--------|-----|
| `PLAN.md` / `task_plan.md` are static markdown | Claude sessions see them, but admin UI does NOT | Sync priorities into `project_tasks` DB table |
| `daily_reports` findings don't auto-create `project_tasks` | Blockers found by cron require manual task creation | Add auto-creation in daily-ops cron |
| Revenue chart is mock data | Admin sees fake financials | Wire to `subscriptions` + `usage_records` |
| `progress.md` not synced to DB | Admin panel doesn't reflect session-level progress | Update `project_tasks` status via API, not markdown |

### Recommendation
To keep docs and dashboard aligned:
1. Use `project_tasks` DB table as the source of truth for work items
2. Use PLAN.md as a **high-level roadmap** (what and why), not a task tracker
3. When Claude Code completes work, update `project_tasks` via `/api/tasks` PATCH, not just markdown

---

## Known Issues (Not Broken, But Need Attention)

| Issue | Severity | Location | Detail |
|-------|----------|----------|--------|
| Silent error swallowing | MEDIUM | 6 `.catch(() => {})` blocks | admin, NPS, audit panels — errors invisible |
| Oversized files | MEDIUM | admin/page.tsx (1,086), settings/page.tsx (1,151), webhook_app.py (1,283) | Exceed 800-line max |
| Hardcoded ADMIN_USER_ID | LOW | usage.ts, feature-gate.ts | Should be env var or DB config |
| `system_alerts` table | LOW | Migration exists, 0 code refs | Alerts computed in-memory, table unused |
| `GOOGLE_MAPS_MAPS_API_KEY` | LOW | maps.ts:61 | Typo in warning message (double MAPS) |
| CRM API key encryption | MEDIUM | crm_connections table | API keys stored in plain text |
| `invoice.created` webhook | MEDIUM | Stripe Dashboard | May not be registered — overage billing won't trigger until added |
| WABA payment method | HIGH | Meta Business Manager | Marketing templates accepted by API but not delivered without payment |
| Null lead_id backfill | MEDIUM | messages table | ~30 messages from Mar 12-14 have null lead_id, need SQL backfill |
| AI assumes agent role | MEDIUM | webhook_app.py system prompt | AI responds as Nadine (agent) even when user is the agent texting |
| AI stuck on old address | MEDIUM | webhook_app.py qualification logic | Lead data overwrite blocked — client can't discuss multiple properties |

---

## Suggested Next Steps (Priority Order)

### P0 — Critical (do first)
1. **Register `invoice.created` in Stripe Dashboard** — Without this, overage billing doesn't trigger. Go to Stripe Dashboard > Webhooks > Add `invoice.created` event.
2. **Add error logging to silent catch blocks** — Replace 6 `.catch(() => {})` with `.catch(console.error)` in admin/NPS/audit panels.

### P1 — High Priority
3. **Connect admin revenue chart to Stripe** — Replace mock `revenueData` with real MRR from `subscriptions` + `usage_records`. This is a data integrity issue — admin sees fake financials.
4. **Auto-create project_tasks from daily_reports findings** — When `/api/cron/daily-ops` finds blockers, create corresponding tasks in `project_tasks` table so they appear in admin UI.
5. **Split oversized files** — `admin/page.tsx` and `settings/page.tsx` into subcomponents. `webhook_app.py` SMS handler into separate module.
6. **Increase test coverage** — Add tests for Stripe webhook, usage limits, feature gating, conversations API. Target 80%+.
7. **Replace Python print() with logging** — 32 statements across webhook_app.py and db.py.
8. **Extract ADMIN_USER_ID to env var** — Currently hardcoded in 2 files.

### P2 — Medium Priority
9. **Implement Settings "Coming Soon" tabs** — Or remove them to avoid confusion.
10. **Encrypt CRM API keys** — App-level AES-256 before storing in crm_connections.
11. **Add Logs page charts** — Activity timeline + log distribution using recharts.

### P3 — Low Priority / Deferred
12. **Twilio A2P 10DLC registration** — Waiting on external Twilio review.
13. **WebSocket for conversations** — 15s polling works at current scale, upgrade later.
14. **2FA** — Nice-to-have post-launch.
15. **Landing page redesign** — CallSine-inspired dark premium aesthetic (plan exists, not started).
16. **Clean up unused `system_alerts` table** — Either use it or drop the migration.
