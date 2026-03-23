# State-by-State Telemarketing Compliance for Real Estate

Quick reference for Estate AI users. Covers SMS/voice/WhatsApp outreach rules by state.
**Not legal advice** — consult an attorney for your specific situation.

Last updated: March 23, 2026

---

## Federal Baseline (applies to ALL states)

| Law | Requirement |
|-----|-------------|
| **TCPA** | Prior express written consent required for automated/prerecorded calls and texts to cell phones. Consent must be clear and conspicuous. |
| **CAN-SPAM** | Commercial emails must include: sender identity, physical address, unsubscribe mechanism (honored within 10 days). No misleading subject lines. |
| **National DNC** | Check the FTC National Do Not Call Registry before calling/texting. Scrub lists every 31 days. RE agents have an established business relationship (EBR) exemption for 18 months after a transaction. |
| **FCC AI Disclosure** | AI-generated voice calls must disclose AI use at the start. Text/messaging guidance pending but best practice is disclosure on first contact. |
| **10DLC** | All business SMS via long codes requires A2P 10DLC registration (brand + campaign). Required by carriers since 2023. |

---

## Top 10 States — Key Differences

### California (CA)
- **CCPA/CPRA**: Right to know, delete, opt-out of sale. Must disclose data collection at or before collection.
- **State DNC**: California DNC list — must scrub against both federal AND state lists.
- **Telemarketing**: Cal. Bus. & Prof. Code §17590-17593. Calls only 8am-9pm. Must identify caller and purpose immediately.
- **RE-specific**: Agents must disclose license number in solicitation materials.
- **Penalties**: Up to $2,500 per violation (CCPA), $500-$1,500 per call (state telemarketing).

### Texas (TX)
- **State DNC**: Texas No-Call List (separate from federal). RE agents are NOT exempt from the Texas list.
- **Telemarketing**: Only 9am-9pm. Must identify business and purpose within first 30 seconds.
- **Texting**: Texas Business & Commerce Code §305.053 — prior consent required for commercial texts.
- **Penalties**: Up to $10,000 per violation.

### Florida (FL)
- **Florida Telephone Solicitation Act**: Registration required for telemarketing businesses. RE agents generally exempt if licensed.
- **State DNC**: Florida DNC list exists. 18-month EBR exemption applies.
- **Hours**: 8am-8pm only. No calls on Sundays or holidays.
- **Texting**: Treated same as calls under state law — need prior express consent.
- **Penalties**: $10,000 per violation.

### New York (NY)
- **State DNC**: New York DNC registry (must register as telemarketer if >250 calls/year).
- **Telemarketing**: Must provide callback number. Calls 8am-9pm only.
- **SHIELD Act**: Data security requirements for businesses holding NY resident data.
- **Penalties**: Up to $11,000 per violation.

### New Jersey (NJ)
- **State DNC**: NJ DNC list — must purchase and scrub. RE agents with EBR are exempt.
- **Consumer Fraud Act**: Broad anti-fraud protections. Misleading communications are actionable.
- **Hours**: 8am-9pm. No calls on Sundays before noon.
- **Texting**: Prior consent required under state telemarketing act.
- **Penalties**: Up to $10,000 per first violation, $20,000 per subsequent.

### Illinois (IL)
- **BIPA**: If collecting biometric data (not typical for Estate AI, but be aware).
- **State DNC**: Illinois DNC list. Register as telemarketer if making >100 calls/month.
- **Telemarketing**: Must identify within first 30 seconds. No calls on legal holidays.
- **Penalties**: $50,000 per violation under state telemarketing act.

### Pennsylvania (PA)
- **State DNC**: PA DNC list. RE agents generally exempt with EBR.
- **Telemarketing Registration**: Must register with PA Attorney General.
- **Hours**: 8am-9pm.
- **Penalties**: Up to $1,000 per violation for residential solicitation.

### Georgia (GA)
- **State DNC**: Georgia DNC list (separate from federal).
- **Telemarketing**: Must disclose identity, purpose, and goods/services within first 30 seconds.
- **Hours**: 8am-8pm.
- **RE-specific**: Licensed agents with EBR are generally exempt from DNC restrictions.
- **Penalties**: Up to $5,000 per violation.

### North Carolina (NC)
- **State DNC**: NC DNC list. Register as telemarketer with Secretary of State.
- **Telemarketing**: Must disclose identity immediately. No calls before 8am or after 9pm.
- **Texting**: Treated as telephone solicitation under state law.
- **Penalties**: Up to $5,000 per violation.

### Arizona (AZ)
- **State DNC**: Arizona DNC list maintained by AG's office.
- **Telemarketing**: Must identify within first 30 seconds. Calls 8am-9pm only.
- **RE-specific**: Licensed agents with active listings are generally exempt.
- **Penalties**: Up to $10,000 per violation under state consumer fraud act.

---

## Best Practices for Estate AI Users

1. **Always scrub against both federal AND state DNC lists** before any outreach campaign.
2. **Obtain prior express written consent** before sending automated texts — an opt-in form, direct message, or verbal consent documented in notes.
3. **Include opt-out on every message** — "Reply STOP to opt out" in SMS, unsubscribe link in email.
4. **Respect quiet hours** — don't send before 8am or after 9pm in the recipient's time zone.
5. **Identify yourself immediately** — agent name + brokerage in first message.
6. **Document consent** — Estate AI logs consent records in the `consent_records` table.
7. **Honor STOP instantly** — Estate AI's STOP detection is automatic. Never re-contact an opted-out number.
8. **Keep the EBR exemption in mind** — if someone inquired about RE services in the last 18 months, you have an established business relationship. But this doesn't override explicit STOP requests.
9. **Register 10DLC** — your SMS campaigns won't deliver reliably without A2P 10DLC brand and campaign registration.
10. **Disclose AI use** — Estate AI adds AI disclosure on first contact per FCC guidance.
