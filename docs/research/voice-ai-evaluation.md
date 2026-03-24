# Voice AI Integration Evaluation
**Date:** March 24, 2026
**Author:** Engineering Operations
**Status:** Draft — Pending Product Review

---

## Executive Summary

Estate AI currently handles lead qualification through text channels (WhatsApp, SMS, Email). The next logical expansion is outbound voice — an AI that phones hot leads within seconds of detection, conducts a qualification conversation, and pushes structured data back into the CRM. This document evaluates four platforms and recommends Retell AI as the integration partner.

---

## Context

Human ISAs (Inside Sales Agents) cost $4,000–$6,000/month per agent and work business hours only. AI voice replaces that function at roughly $500–$1,500/month while operating 24/7. Real estate brokers who deployed AI voice calling report 2,800% ROI in month one, a 60% increase in lead conversion, and 42% reduction in cost per lead.

The trigger model is straightforward: our Python webhook already scores leads in real time. When a lead crosses a "hot" threshold (score ≥ 70, intent confirmed), we fire an outbound call instead of — or in addition to — a WhatsApp follow-up.

---

## Platform Evaluations

### 1. Bland AI (bland.ai)

**Pricing**
- Free tier: $0.14/min (raised from $0.09 in December 2025)
- Build plan: $299/month at $0.12/min
- Scale plan: $499/month at $0.11/min
- Transfer fee add-on: $0.03–$0.05/min when routing to a human
- Minimum charge applies on failed outbound calls (~$0.015/call)

**Real Estate Features**
- Used by real estate teams for lead qualification and property tour scheduling
- No purpose-built real estate templates; prompts are custom

**Voice Quality / Latency**
- Average latency: 700–900ms per conversational turn
- Highest latency among the four platforms evaluated
- Conversational pauses are noticeable in user-reported reviews

**Integration API**
- REST API: outbound calls require ~10 lines of code
- Post-call webhooks supported (fires JSON payload to your endpoint on call completion)
- Integrates with Zapier and Pipedream for no-code automation

**Pros**
- Lowest per-minute cost on paid plans
- Simple API surface — fast to prototype
- Developer-friendly docs

**Cons**
- 700–900ms latency creates robotic-feeling pauses — a significant UX problem for qualification calls
- Pricing increased 55% on free tier in December 2025; trajectory is upward
- No real estate-specific templates or workflows
- User reviews cite latency as the primary complaint in 2026

---

### 2. Vapi AI (vapi.ai)

**Pricing**
- Advertised: $0.05/min (platform/orchestration layer only)
- True all-in cost: $0.15–$0.33/min after adding STT ($0.01), LLM ($0.02–$0.20), TTS ($0.04), telephony ($0.01)
- New accounts receive $10 in free credits; no ongoing free tier
- Cost is unpredictable because it stacks across 4–5 third-party billing relationships

**Real Estate Features**
- Published blog post on real estate use cases (24/7 lead capture, property Q&A, tour booking)
- No pre-built real estate templates; fully custom configuration
- A GitHub project exists for Vapi + n8n + Airtable real estate outbound agent (open source reference)

**Voice Quality / Latency**
- Sub-500ms response latency in most configurations
- Multiple reviewers describe responses as "near-human timing"
- Supports 100+ languages and accents

**Integration API**
- Programmatic outbound calls with scheduling support
- Server URL / webhook model for real-time call events
- Custom Tools (functions) callable mid-conversation via webhook
- Well-documented, large developer community

**Pros**
- Best-in-class developer flexibility — full control over STT, LLM, TTS providers
- Excellent documentation; large community
- Low latency when configured well
- Can swap OpenAI for a cheaper LLM to reduce costs

**Cons**
- Requires meaningful engineering time — not plug-and-play
- True cost is 3–6x the advertised rate and hard to budget
- No guided multi-step logic; every conditional workflow requires developer implementation
- Pricing complexity creates ongoing operational overhead

---

### 3. Retell AI (retellai.com)

**Pricing**
- All-in flat rate: $0.07+/min (single fee covers voice synthesis, STT, LLM, telephony)
- $10 in free credits on signup; no commitment
- 20 concurrent calls included free; additional capacity at $8/concurrent call/month
- Real-world production cost: $0.13–$0.31/min with premium voice and LLM options
- Pay-as-you-go; no contracts

**Real Estate Features**
- Published lead qualification use case and no-code builder walkthrough for real estate
- Pre-built n8n workflow templates: "Outbound sales calls from Google Sheets" and "Automate lead qualification with Retell AI + OpenAI + Google Sheets"
- AI SDR template adaptable to real estate qualification scripts
- Voicemail detection built in

**Voice Quality / Latency**
- ~600ms latency — lowest measured among the four platforms
- LLM-native agents with interruption handling (agents can be interrupted mid-sentence, like a real person)
- User reviews consistently describe voices as "lifelike" and conversations as "smooth and fluent"
- G2 and Product Hunt reviewers in 2026 rank voice naturalness as a standout

**Integration API**
- Webhook overview: real-time event push on call start, call end, transcript, status changes
- Webhook retry: 3 retries with 10-second timeout
- Outbound call trigger: single POST request with phone number, agent ID, and metadata
- Post-call data includes full transcript, call outcome, and structured variables extracted during the call

**Pros**
- Lowest latency of all four platforms
- Transparent flat-rate pricing — no surprise bills
- Closest to production-ready for real estate without heavy custom work
- Interruption handling makes conversations feel human
- Webhook integration matches our existing Python webhook architecture

**Cons**
- Less provider flexibility than Vapi (Retell controls the full stack)
- Premium voice options push cost toward $0.25–$0.31/min
- Smaller developer community than Vapi

---

### 4. Synthflow AI (synthflow.ai)

**Pricing**
- Starter: $29/month (50 included minutes)
- Pro: $450/month (2,000 included minutes)
- Growth: $900/month (4,000 included minutes)
- Agency: $1,400/month (6,000 included minutes)
- Pay-as-you-go: $0.08/min (enterprise: $0.07/min)
- No charge for failed calls

**Real Estate Features**
- Explicit real estate use cases: buyer preference capture (location, budget, timeline), lead qualification, appointment scheduling
- No-code drag-and-drop agent builder (no engineering required)
- Integrates with HubSpot, Twilio, Zapier out of the box

**Voice Quality / Latency**
- Voice quality rated highly by users — described as "remarkably human"
- Latency not published; user reviews call it "quite good" but provide no benchmarks
- No third-party latency comparisons available

**Integration API**
- Post-call webhook: fires JSON on call completion
- Webhooks overview documentation exists but API-level outbound call triggering requires Pro tier or above
- No-code-first orientation; API access is secondary

**Pros**
- Easiest setup — no coding required for basic flows
- No charge on failed calls (important for outbound campaigns with voicemail rates)
- Real estate-specific workflow design documented by the vendor
- Bundles minutes into monthly plans, predictable billing

**Cons**
- Bundled minute plans are expensive at low volume ($450/month for 2,000 minutes vs. Retell's pay-as-you-go)
- No-code focus means limited customization for complex qualification logic
- Latency not benchmarked against competitors; unverified claims
- API access is secondary, not primary — triggering calls from our webhook is more friction

---

## Side-by-Side Comparison

| Dimension | Bland AI | Vapi AI | Retell AI | Synthflow |
|---|---|---|---|---|
| All-in cost/min | $0.11–$0.14 | $0.15–$0.33 | $0.13–$0.31 | $0.08–$0.23 |
| Latency | 700–900ms | <500ms | ~600ms | Not benchmarked |
| Real estate templates | None | Blog only | Yes (n8n + SDR) | Yes (no-code) |
| API trigger (outbound) | Yes (10 lines) | Yes (full API) | Yes (single POST) | Yes (Pro+ tier) |
| Post-call webhook | Yes | Yes | Yes | Yes |
| Interruption handling | Not noted | Yes | Yes | Not noted |
| Setup complexity | Low | High | Medium | Very low |
| Pricing predictability | Medium | Low | High | High |

---

## Recommendation: Retell AI

### Why Retell

Retell AI best matches Estate AI's requirements across all four dimensions that matter for a CRM-embedded voice ISA.

**Latency wins the conversation.** At 600ms, Retell is the only platform that consistently avoids the robotic-pause problem. For a qualification call where the AI needs to ask about budget, timeline, and intent, any latency above 700ms risks the prospect hanging up. Bland AI's 800ms average is a disqualifying weakness for this use case.

**Pricing is predictable.** Our cost modeling requires knowing what each call costs before we can price the feature for users. Vapi's stacked billing across 4–5 providers makes this impossible to forecast. Retell's flat $0.07+ rate means we can model unit economics immediately.

**Integration fits our architecture.** Estate AI's Python webhook (`tools/webhook_app.py`) already handles inbound WhatsApp/SMS events and fires follow-up logic. Adding a Retell outbound call trigger is a single POST request appended to the existing hot-lead detection branch. Post-call webhooks return structured transcripts that we write directly to the `messages` table.

**Real estate workflows exist.** Retell has published ISA-style lead qualification templates and n8n workflow examples. We are not building from zero.

---

## Integration Design

### Trigger Point

In `tools/webhook_app.py`, the `process_inbound_message()` function currently scores leads and decides between AI reply and simple acknowledgment. The proposed addition:

```
if lead_score >= 70 and lead.intent in ['buy', 'sell']:
    trigger_retell_outbound_call(lead.phone, lead.id, user.id)
```

This fires only once per lead (gate on a `voice_call_attempted` flag in the `leads` table) to avoid repeated calls.

### Data Flow

```
Python webhook detects hot lead
  → POST /v2/create-phone-call to Retell API
      payload: phone number, agent ID, metadata (lead_id, user_id)
  → Retell places call, AI conducts qualification
  → On call end, Retell fires POST to our webhook endpoint (/webhook/retell/post-call)
      payload: transcript, call duration, extracted variables (budget, timeline, intent)
  → We write transcript to messages table (channel = 'voice')
  → We update leads table: score, qualification_status, voice_call_at
  → We log activity via logActivity()
```

### New Webhook Endpoint Required

A new Flask route `/webhook/retell/post-call` in `tools/webhook_app.py` (or split into a new `tools/voice_agent.py` to keep file size under 800 lines — file is currently 1,076 lines and already flagged for refactoring).

### Schema Changes Needed (requires approval)

- `leads` table: add `voice_call_at` (timestamp), `voice_call_outcome` (text), `voice_qualified` (boolean)
- `messages` table: `channel` already supports extensible values — add 'voice' as valid option

---

## Pricing Impact

### Our Cost per Minute

At $0.13/min (Retell base + ElevenLabs voice), a typical 3-minute qualification call costs $0.39. At $0.20/min with premium LLM, the same call costs $0.60.

Conservative model: $0.50 per call average (3 min at ~$0.17/min blended).

### What to Charge Users

Voice calling should be a Pro/Agency feature only, consistent with our existing feature gate model.

| Plan | Voice Included | Overage Rate |
|---|---|---|
| Starter | Not available | — |
| Pro ($249/mo) | 50 calls/month | $1.50/call |
| Agency ($499/mo) | 200 calls/month | $1.25/call |

At 50 calls/month on Pro, platform cost is ~$25 (50 × $0.50). We include this in the plan margin (current gross margin is ~80–85%; this feature adds ~$25 COGS with zero charge to user for included calls). Overages at $1.50/call yield $1.00 net margin per overage call.

This is conservative. Real estate agents typically expect to pay $3–$5 per AI-qualified lead. At $1.50/call with a 30% qualification rate, our effective cost per qualified lead is $5.00 — competitive with human ISA cost of $15–$30 per qualified lead.

---

## Build vs. Buy Decision

**Buy (Retell AI).** Do not build a custom voice pipeline.

Building a voice AI stack (Twilio Programmable Voice + Deepgram STT + OpenAI Realtime API + ElevenLabs TTS) would take 4–8 weeks of engineering, introduce 4 new vendor relationships to manage, and produce a worse latency result than Retell's purpose-built pipeline. Retell's $0.07+/min covers all of those components.

The only scenario where building makes sense is at 100,000+ minutes/month volume, where custom infrastructure could cut costs by 50%. Estate AI will not reach that volume before Series A. Revisit this decision at $50K MRR.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Lead hangs up before AI qualifies | Medium | Keep calls under 90 seconds; ask 3 targeted questions only |
| TCPA compliance on outbound AI calls | High | Require explicit consent at lead capture; log consent in consent_records table |
| Retell pricing increase (Bland precedent) | Low | Pay-as-you-go avoids long-term lock-in; Vapi is a credible fallback |
| Voice call fatigue / opt-out rate | Medium | Gate behind a per-user on/off setting; don't call leads who've already responded |

---

## Next Steps (requires product approval)

1. Create Retell AI account and test qualification script (1 day)
2. Add `voice_call_at`, `voice_call_outcome`, `voice_qualified` columns to `leads` table
3. Add 'voice' as valid channel in `messages` table
4. Create `tools/voice_agent.py` with outbound trigger + post-call webhook handler
5. Add `RETELL_API_KEY` to environment variables
6. Add `voice_calling` to `GatedFeature` type in `app/lib/billing/feature-gate.ts` (Pro minimum)
7. Add call count tracking to usage system (`voice_calls` alongside `included_sms`)
8. QA: test with Karim's number (+13474452049) before any user-facing rollout
