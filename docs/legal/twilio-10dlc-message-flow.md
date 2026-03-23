# Twilio A2P 10DLC Campaign — Message Flow / Call to Action

Use this text when resubmitting the 10DLC campaign registration on Twilio.
Addresses the 30909 rejection for incomplete CTA verification.

---

## Campaign Description

Estate AI is a SaaS platform used by licensed real estate agents to communicate with property owners and leads via SMS. Messages include property inquiries, appointment scheduling, follow-up communications, and market updates.

## Message Flow / Call to Action (CTA)

**Copy this entire block into the Twilio "Message Flow / Call to Action" field:**

```
End users consent to receive SMS messages from Estate AI through one or more of the following methods:

1. WEB FORM OPT-IN: Users submit a property inquiry form on the agent's website (powered by Estate AI at https://realestate-ai.app). The form includes: (a) a checkbox with the disclosure "By providing your phone number, you consent to receive SMS/MMS messages from [Agent Name] via Estate AI regarding real estate opportunities. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Terms: https://realestate-ai.app/terms Privacy: https://realestate-ai.app/privacy-policy", (b) the user must check the box before submitting.

2. DIRECT AGENT CONTACT: Licensed real estate agents using Estate AI collect phone numbers directly from property owners during in-person meetings, phone calls, or networking events. Agents verbally disclose: "I use an AI-assisted messaging platform to stay in touch with clients. You may receive text messages about real estate opportunities. You can opt out at any time by replying STOP." Consent is documented in the Estate AI platform's consent_records database with timestamp, source, and consent type.

3. CSV IMPORT WITH PRIOR CONSENT: Agents import lead lists from their existing CRM systems (e.g., Follow Up Boss) where consent was previously obtained through the agent's own opt-in processes. Upon import, Estate AI records a consent record for each phone number with source "csv_import".

4. INBOUND TEXT (CONVERSATIONAL): Property owners who initiate contact by texting the agent's business number are engaging in a two-way conversation. The first automated reply includes the disclosure: "Automated reply — [Agent Name]'s AI assistant." This constitutes implied consent for the ongoing conversation thread.

BRAND IDENTIFICATION: All messages identify the sending agent by name and brokerage (e.g., "Hi, it's Nadine Khalil from KW Commercial").

MESSAGE FREQUENCY: Message frequency varies based on user engagement. Typical: 1-4 messages per month for marketing/follow-ups. Conversational messages may be more frequent during active discussions.

OPT-OUT: Users can opt out at any time by replying STOP, UNSUBSCRIBE, CANCEL, END, or QUIT to any message. Upon opt-out, the user receives a single confirmation: "You're unsubscribed. You won't receive any further messages. Thank you for letting us know." The phone number is immediately added to our Do Not Contact list and no further messages are sent.

OPT-IN CONFIRMATION: After opt-in via web form, users receive: "Thanks for connecting with [Agent Name]! You'll receive updates about real estate opportunities. Reply STOP to opt out. Msg&data rates may apply."

TERMS: https://realestate-ai.app/terms
PRIVACY POLICY: https://realestate-ai.app/privacy-policy
HELP: Reply HELP or contact support@realestate-ai.app / (848) 456-9428
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
Hi John, just confirming our meeting tomorrow at 2 PM to discuss your property at 123 Main St. Looking forward to it! - Nadine Khalil, KW Commercial
```

---

## Campaign Details for Twilio Form

| Field | Value |
|-------|-------|
| Campaign Description | Licensed real estate agents use Estate AI to send property-related SMS to leads who have opted in via web form, direct contact, or inbound text |
| Use Case | Mixed (Marketing + Conversational) |
| Subscriber Opt-In | Web form, direct agent contact (verbal/in-person), inbound text, CSV import with prior consent |
| Subscriber Opt-Out | Reply STOP to any message |
| Subscriber Help | Reply HELP or email support@realestate-ai.app |
| Terms URL | https://realestate-ai.app/terms |
| Privacy URL | https://realestate-ai.app/privacy-policy |
| Message Frequency | Varies, typically 1-4/month. Conversational may be more frequent. |
| Embedded Links | No (unless agent includes property listing links) |
| Embedded Phone | Yes (agent phone number in signature) |
| Age-Gated Content | No |
| Direct Lending/Loan | No |

---

## Resubmission Checklist

- [ ] Copy the Message Flow text above into Twilio's CTA field
- [ ] Add all 3 sample messages
- [ ] Verify https://realestate-ai.app/terms is accessible (not behind login)
- [ ] Verify https://realestate-ai.app/privacy-policy is accessible
- [ ] Ensure brand name matches ("Estate AI" / "EYWA Consulting Services Inc")
- [ ] Submit and wait 3-7 business days for review
