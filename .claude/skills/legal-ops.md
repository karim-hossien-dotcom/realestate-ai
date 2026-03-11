---
name: legal-ops
description: Legal operations workflows - compliance checking, policy maintenance, and DNC enforcement for Estate AI
user_invocable: true
commands:
  compliance: Run full compliance audit across messaging channels and AI disclosures
  policies: Review and update legal pages (privacy policy, terms, cookies)
  dnc: Audit DNC list enforcement and STOP handling
---

# Legal Operations Skills

## /legal-ops:compliance

Full compliance audit.

### Steps:
1. **TCPA Check:**
   - Verify consent collection before marketing messages
   - Confirm STOP keyword handling in `ai_inbound_agent.py`
   - Check message frequency limits
2. **CAN-SPAM Check:**
   - Verify unsubscribe link in email templates
   - Test `/api/email/unsubscribe` endpoint
   - Check sender identification
3. **CCPA Check:**
   - Verify privacy rights notice on `/privacy-policy`
   - Check data deletion capability
   - Verify opt-out mechanism
4. **AI Disclosure Check:**
   - Search for AI disclosure in outbound messages
   - Verify contacts know they're communicating with AI
5. Generate compliance report to `reports/daily/compliance-YYYY-MM-DD.md`

## /legal-ops:policies

Review legal pages for accuracy.

### Steps:
1. Read `/privacy-policy/page.tsx`, `/terms/page.tsx`, `/cookies/page.tsx`
2. Verify company name: "EYWA Consulting Services Inc" (d/b/a Estate AI)
3. Check contact information accuracy
4. Verify data handling descriptions match actual implementation
5. Check for outdated references or missing disclosures
6. Flag any gaps between stated practices and code behavior

## /legal-ops:dnc

Audit DNC enforcement.

### Steps:
1. Verify DNC check happens before every outbound message
2. Review STOP keyword detection patterns (English + Arabic + Spanish)
3. Check that DNC additions are immediate (no delayed processing)
4. Verify DNC list is checked across all channels (WhatsApp + SMS + Email)
5. Test STOP handling flow end-to-end in code
6. Report any gaps in DNC enforcement

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
