# Twilio A2P 10DLC Campaign — Message Flow / Call to Action

**RESUBMISSION #2** — Addresses 30909 rejection. Previous rejection cause:
"opt-in occurs outside a website, the information provided was incomplete."

**Key fix:** Added public SMS consent page at https://realestate-ai.app/sms-consent
that documents ALL opt-in methods with visible examples. Twilio reviewers can
visit this URL without logging in.

---

## Campaign Description

Estate AI is a SaaS platform used by licensed real estate agents to communicate with property owners and leads via SMS. Messages include property inquiries, appointment scheduling, follow-up communications, and market updates. End users are NOT direct customers of Estate AI — they are clients of the licensed agents who use the platform.

## Message Flow / Call to Action (CTA)

**Copy this entire block into the Twilio "Message Flow / Call to Action" field:**

```
End users consent to receive SMS messages through one or more of the following methods. Full opt-in documentation with examples is publicly available at: https://realestate-ai.app/sms-consent

1. WEB FORM OPT-IN: Agents embed a property inquiry form on their websites. The form requires a consent checkbox before submission with the disclosure: "By providing your phone number, you consent to receive SMS/MMS messages from [Agent Name] via Estate AI regarding real estate opportunities. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Terms: https://realestate-ai.app/terms Privacy: https://realestate-ai.app/privacy-policy". After submission, users receive an opt-in confirmation: "Thanks for connecting with [Agent Name]! You'll receive updates about real estate opportunities. Reply STOP to opt out. Msg&data rates may apply."

2. INBOUND TEXT (CONVERSATIONAL): Property owners initiate contact by texting the agent's business number. The first automated reply includes: "Automated reply from [Agent Name]'s AI assistant at [Brokerage]. Msg&data rates may apply. Reply STOP to opt out."

3. DIRECT AGENT CONTACT: Licensed agents collect phone numbers during in-person meetings, open houses, or calls. Agents verbally disclose: "I use an AI-assisted messaging platform to stay in touch. You may receive text messages about real estate opportunities. Message and data rates may apply. Reply STOP to opt out." Consent is recorded in our system with timestamp, source, and agent attestation. Agents agree to consent collection requirements per our Terms of Service (Section 9.2).

4. CRM IMPORT: Agents import contacts from existing CRM systems where consent was previously obtained. Agent attests prior consent exists for each contact. Consent record created with source "csv_import" and agent ID.

BRAND IDENTIFICATION: Every message identifies the agent by name and brokerage (e.g., "Hi, it's Nadine Khalil from KW Commercial").

MESSAGE FREQUENCY: 1-4 messages per month typical. Conversational replies may be more frequent.

MESSAGE AND DATA RATES: Message and data rates may apply.

OPT-OUT: Reply STOP, UNSUBSCRIBE, CANCEL, END, or QUIT. Confirmation sent: "You're unsubscribed. You won't receive any further messages." Number added to Do Not Contact list immediately.

HELP: Reply HELP or contact support@realestate-ai.app / (848) 456-9428.

TERMS: https://realestate-ai.app/terms
PRIVACY: https://realestate-ai.app/privacy-policy
OPT-IN DOCUMENTATION: https://realestate-ai.app/sms-consent
```

---

## Sample Messages (provide 2-3 in Twilio)

**Sample 1 — Property Outreach:**
```
Hi John, it's Nadine Khalil from KW Commercial. We recently sold a building near your property at 123 Main St and have buyers looking in your area. Would you be open to a quick conversation about your property's current market value? Reply STOP to opt out.
```

**Sample 2 — Follow-Up:**
```
Hi John, it's Nadine from KW Commercial. We chatted about your property at 123 Main St. The market has had some movement since then — happy to share an updated analysis. Are you still thinking about your options? Reply STOP to opt out.
```

**Sample 3 — Appointment Confirmation:**
```
Hi John, confirming our meeting tomorrow at 2 PM to discuss your property at 123 Main St. Looking forward to it! - Nadine Khalil, KW Commercial. Reply STOP to opt out.
```

---

## Campaign Details for Twilio Form

| Field | Value |
|-------|-------|
| Campaign Description | Licensed real estate agents use Estate AI to send property-related SMS to leads who have opted in via web form, direct contact, or inbound text. Full opt-in documentation: https://realestate-ai.app/sms-consent |
| Use Case | Mixed (Marketing + Conversational) |
| Subscriber Opt-In | Web form with consent checkbox, inbound text, direct agent contact with verbal disclosure, CRM import with prior consent attestation |
| Subscriber Opt-Out | Reply STOP to any message |
| Subscriber Help | Reply HELP or email support@realestate-ai.app / (848) 456-9428 |
| Terms URL | https://realestate-ai.app/terms |
| Privacy URL | https://realestate-ai.app/privacy-policy |
| Message Frequency | Varies, typically 1-4/month |
| Embedded Links | No |
| Embedded Phone | Yes (agent phone in signature) |
| Age-Gated Content | No |
| Direct Lending/Loan | No |

---

## Resubmission Checklist

- [ ] Verify https://realestate-ai.app/sms-consent is live and accessible
- [ ] Verify https://realestate-ai.app/terms is accessible
- [ ] Verify https://realestate-ai.app/privacy-policy is accessible
- [ ] Copy the Message Flow text above into Twilio's CTA field
- [ ] Add all 3 sample messages (each includes "Reply STOP to opt out")
- [ ] Ensure brand name matches ("Estate AI" / "EYWA Consulting Services Inc")
- [ ] In Campaign Description, include the sms-consent URL
- [ ] Submit and wait 3-7 business days for review

## What Changed from Previous Submission

1. **Added public /sms-consent page** — Twilio reviewers can now visit a public URL to see all opt-in methods documented with examples. Previously, everything was behind the SaaS login.
2. **Reordered opt-in methods** — Put "Inbound Text" second (easier for reviewers to verify) and "CRM Import" last.
3. **Added "Reply STOP to opt out" to ALL sample messages** — Sample 3 was missing it.
4. **Added agent attestation language** for verbal consent and CRM import — addresses the "incomplete or insufficiently detailed" rejection reason.
5. **Referenced /sms-consent URL in the CTA** — gives reviewers a single public page to verify everything.
