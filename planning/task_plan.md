# Estate AI — Task Plan (Updated Mar 17)

## Status Summary

**Phases 1-3 from the original Mar 9 audit are 100% COMPLETE.** 37 commits since Mar 9 addressed all original items plus significant new features. Only deferred items and new priorities remain.

---

## Phase 1: Quick Wins — COMPLETE

| # | Task | Status | Commit |
|---|------|--------|--------|
| Q1 | Fix privacy policy company name | DONE | `ca867db` (Mar 9) |
| Q2 | Fix login testimonial | DONE | `ca867db` (Mar 9) |
| Q3 | Delete dead code (`tools/web_app.py`) | DONE | `ca867db` (Mar 9) |
| Q4 | Remove non-functional "Remember me" checkbox | DONE | `ca867db` (Mar 9) |
| Q5 | Deprecate `get_default_user_id()` | DONE | `ca867db` (Mar 9) |

---

## Phase 2: Security Hardening — 3 of 4 COMPLETE

| # | Task | Status | Commit |
|---|------|--------|--------|
| S1 | CSV import formula injection protection | DONE | `ca867db` (Mar 9) |
| S2 | Font Awesome CDN SRI hash | DONE | `ca867db` (Mar 9) |
| S3 | Python webhook rate limiting (60 req/min) | DONE | `ca867db` (Mar 9) |
| S4 | CRM API key encryption | OPEN | Deferred — needs app-level AES-256 |

---

## Phase 3: Performance & UX — COMPLETE

| # | Task | Status | Commit |
|---|------|--------|--------|
| P1 | Leads pagination (server-side, 50/page) | DONE | `ca867db` (Mar 9) |
| P2 | Batch delete endpoint (`ids[]`) | DONE | `ca867db` (Mar 9) |
| P3 | Campaign results persistence + history GET | DONE | `ca867db` (Mar 9) |
| P4 | Conversation polling → WebSocket | DEFERRED | 15s polling works at current scale |

---

## Phase 4: Post-Audit Work (Mar 11-16) — NEW

Major features and fixes delivered across 32 commits after the original audit:

### Mar 11-12: Messaging & Billing

| Task | Status | Commit |
|------|--------|--------|
| Enforce messaging quota on all send paths + shared pool | DONE | `dcd3f49` |
| Overage billing + feature gating by plan tier (16 files) | DONE | `a01c3b7` |
| Remove dead code and unused dependencies (-1,096 lines) | DONE | `189e73a` |
| Normalize phone lookups (prevent lead context loss) | DONE | `43649f9` |
| Multi-texter debounce + conversation history fix + natural AI tone | DONE | `759da49` |

### Mar 14: WhatsApp Template Restoration

| Task | Status | Commit |
|------|--------|--------|
| Restore WhatsApp templates for campaigns + follow-ups | DONE | `c6bf9d8` |
| Hardcode default template name (no env var dependency) | DONE | `6f4afa8` |
| Fix `nulls_last` crash in supabase-py SDK | DONE | `f1b1d3e` |
| Pass full outreach message as template body param | DONE | `0957291` |
| Detect agent self-messages + backfill null lead_ids | DONE | `6864b34` |

### Mar 16: Cleanup, Logging & New Features

| Task | Status | Commit |
|------|--------|--------|
| Replace 6 silent `.catch(() => {})` with `.catch(console.error)` | DONE | `edd74c0` |
| Replace 35 Python `print()` with logging module | DONE | `edd74c0` |
| Extract ADMIN_USER_ID to env var (11 files) | DONE | `3729206` |
| Connect admin revenue chart to Stripe (real MRR) | DONE | `3729206` |
| Fix `GOOGLE_MAPS_MAPS_API_KEY` typo | DONE | `3729206` |
| Restore agent self-message detection in webhook | DONE | `530fcb2` |
| Split oversized admin + settings pages into subcomponents | DONE | `0683cb7` |
| Use UTILITY template for campaigns/follow-ups (WABA bug workaround) | DONE | `90aee71` |
| 3-tier WhatsApp send: plain text → utility → marketing | DONE | `bd17470` |
| VIP bypass list for usage limits + feature gating | DONE | `6144aee` |
| Smart campaign messages personalized by lead intent | DONE | `7ad5cd6` |
| Mark Smart Calendar as completed in competitor matrix | DONE | `2616f15` |

---

## Phase 5: Mar 20-23 — AI Quality, Testing, UX Cleanup

| Task | Status | Commit |
|------|--------|--------|
| Upgrade AI model from gpt-4o-mini → gpt-4o + json_object format | DONE | `52dee8f` |
| Fix false unsubscribe ("Thanks" → stop) + 7 critical AI rules | DONE | `df57af7` |
| Test coverage 43 → 197 tests (5 new test files) | DONE | `52dee8f` |
| AI conversation quality simulation (8 scenarios) | DONE | `209cbdd` |
| Auto-create project_tasks from daily_reports findings | DONE | `e6d6337` |
| Split webhook_app.py SMS handler (1312 → 992 + 295 lines) | DONE | `e6d6337` |
| Remove Settings "Coming Soon" placeholder tabs | DONE | `f495f8b` |
| Add Logs page activity timeline + event distribution charts | DONE | `f495f8b` |

---

## Remaining Work (Priority Order)

### P1 — High Priority
1. **Encrypt CRM API keys** — App-level AES-256 before storing in `crm_connections`.
2. **Register `invoice.created` in Stripe Dashboard** — Paused, revisit after stabilization.

### P2 — Medium Priority
3. **Twilio A2P 10DLC registration** — Waiting on external review.
4. **Landing page redesign** — CallSine-inspired dark premium aesthetic (plan exists).

### P3 — Deferred
5. **WebSocket for conversations** — Upgrade later when scale demands it.
6. **2FA** — Nice-to-have post-launch.
7. **Clean up unused `system_alerts` table** — Either use it or drop migration.

### Business Documents
See [`docs/finance-model-updates.md`](docs/finance-model-updates.md) and [`docs/pitch-deck-corrections.md`](docs/pitch-deck-corrections.md) for Excel/PowerPoint update guides.
