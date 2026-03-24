"""
Test Campaign Context — Verify AI replies stay on-topic for each campaign template.

Simulates a lead replying to each of the 8 campaign templates and checks
that the AI response is relevant to the campaign subject matter.

Usage:
  cd ~/Desktop/realestate-ai
  python tools/test_campaign_context.py
"""

import os
import sys
import json

# Ensure tools/ is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai_inbound_agent import analyze_with_ai

# ── Campaign templates (mirrors campaign-templates.ts) ──
CAMPAIGNS = [
    {
        "id": "commercial-prospecting",
        "name": "Commercial Prospecting",
        "outbound": "Hi John, we recently sold a building near 123 Main St for a premium and have an overflow of buyers from that sale. We're reaching out to local property owners to see if you're considering selling in the next 3-6 months. Is this something you'd have interest in exploring? - Nadine, KW Commercial",
        "lead_reply": "Yeah I might be interested, what kind of prices are you seeing?",
        "must_mention": ["sell", "property", "price", "market", "value"],
        "must_not_mention": ["valuation", "FSBO", "expired", "invest"],
    },
    {
        "id": "circle-prospecting",
        "name": "Circle Prospecting (Neighborhood)",
        "outbound": "Hi John, there's been a lot of interest in the Downtown area recently. I'm reaching out to local property owners — who do you know that might be thinking of making a move this year? And just out of curiosity, when do you plan on moving? - Nadine",
        "lead_reply": "I'm not planning to move but my neighbor mentioned selling",
        "must_mention": ["neighbor", "connect", "help"],
        "must_not_mention": ["expired", "FSBO", "invest"],
    },
    {
        "id": "expired-listing",
        "name": "Expired Listing Outreach",
        "outbound": "Hi John, I noticed your property at 456 Oak Ave was previously listed but didn't sell. Even the best properties don't always sell on the first go — it usually just takes a new approach. Would you be open to a quick conversation about a different strategy? - Nadine",
        "lead_reply": "Yeah it sat for 6 months. What would you do differently?",
        "must_mention": ["strategy", "approach", "marketing", "sell"],
        "must_not_mention": ["valuation offer", "invest", "FSBO"],
    },
    {
        "id": "fsbo-outreach",
        "name": "FSBO (For Sale By Owner)",
        "outbound": "Hi John, I saw your property at 789 Pine Rd is for sale by owner — is it still available? I work with buyers in the area and I'm building a list of all properties available, not just MLS. If you could keep doing what you're doing AND have an agent get you more money in less time, would you want to hear about it? - Nadine",
        "lead_reply": "It's still available. How would you help?",
        "must_mention": ["buyer", "sell", "agent", "market"],
        "must_not_mention": ["expired", "invest", "neighborhood"],
    },
    {
        "id": "investor-outreach",
        "name": "Investment Opportunity",
        "outbound": "Hi John, I work with investors looking at properties in Miami. Values haven't reached peak pricing yet and we're seeing strong cap rates on a few deals right now. Would you be interested in hearing about some opportunities? - Nadine",
        "lead_reply": "What kind of cap rates are you seeing?",
        "must_mention": ["cap rate", "invest", "return", "property", "deal"],
        "must_not_mention": ["expired", "FSBO", "selling your home"],
    },
    {
        "id": "cold-reengagement",
        "name": "Cold Lead Re-engagement",
        "outbound": "Hi John, it's Nadine from KW Commercial. You reached out a while back about real estate. I wanted to check — did you end up buying or selling, or are you still in the market? Either way, I'd love to reconnect. - Nadine",
        "lead_reply": "Hey Nadine, no I didn't end up doing anything. Still thinking about it though",
        "must_mention": ["buy", "sell", "market", "help", "move", "thinking", "looking"],
        "must_not_mention": ["expired", "FSBO"],
    },
    {
        "id": "free-valuation",
        "name": "Free Property Valuation",
        "outbound": "Hi John, I'm offering complimentary market valuations for properties in Downtown this month. Curious what 123 Main St could sell for in today's market? I can put together a detailed analysis — no obligation. Interested? - Nadine",
        "lead_reply": "Yes I'd like to know what it's worth",
        "must_mention": ["valuation", "analysis", "market", "property"],
        "must_not_mention": ["expired", "FSBO", "invest"],
    },
    {
        "id": "commercial-followup",
        "name": "Commercial Platform Inquiry Follow-Up",
        "outbound": "Hi John, this is Nadine with KW Commercial. I saw you viewed a property on one of our commercial platforms. Did you have a chance to look at the details? Any questions I can help answer? Would you be interested in scheduling a tour? - Nadine",
        "lead_reply": "Yes I looked at it. Can we schedule a tour?",
        "must_mention": ["tour", "schedule", "time", "property", "visit"],
        "must_not_mention": ["expired", "FSBO", "valuation"],
    },
]

LEAD_DETAILS = {
    "owner_name": "John Smith",
    "phone": "+13475551234",
    "email": "john@example.com",
    "property_address": "123 Main St",
    "property_type": "commercial",
    "status": "contacted",
}


def run_tests():
    """Run all campaign context tests."""
    print("\n" + "=" * 70)
    print("CAMPAIGN CONTEXT TEST — 8 Templates")
    print("=" * 70)

    results = []
    for i, campaign in enumerate(CAMPAIGNS, 1):
        print(f"\n--- Test {i}/8: {campaign['name']} ---")
        print(f"  Campaign sent: {campaign['outbound'][:80]}...")
        print(f"  Lead replies:  {campaign['lead_reply']}")

        # Build conversation history as it would look with the fix
        conversation_history = [
            {
                "direction": "outbound",
                "body": campaign["outbound"],
                "channel": "whatsapp",
                "created_at": "2026-03-23T10:00:00Z",
                "from_number": "+18484569428",
                "to_number": "+13475551234",
                "campaign_id": f"fake-{campaign['id']}",
                "campaign_name": campaign["name"],
            },
            {
                "direction": "inbound",
                "body": campaign["lead_reply"],
                "channel": "whatsapp",
                "created_at": "2026-03-24T14:00:00Z",
                "from_number": "+13475551234",
                "to_number": "+18484569428",
                "campaign_id": None,
            },
        ]

        try:
            result = analyze_with_ai(
                owner_message=campaign["lead_reply"],
                from_number="+13475551234",
                to_number="+18484569428",
                conversation_history=conversation_history,
                lead_details=LEAD_DETAILS,
                agent_name="Nadine Khalil",
                agent_brokerage="KW Commercial",
                campaign_context=campaign["name"],
            )

            reply = result.get("reply", "")
            intent = result.get("intent", "unknown")
            print(f"  AI intent:     {intent}")
            print(f"  AI reply:      {reply[:120]}...")

            # Check relevance
            reply_lower = reply.lower()
            matched_keywords = [kw for kw in campaign["must_mention"] if kw.lower() in reply_lower]
            bad_keywords = [kw for kw in campaign["must_not_mention"] if kw.lower() in reply_lower]

            keyword_match = len(matched_keywords) >= 1  # At least 1 relevant keyword
            no_bad_keywords = len(bad_keywords) == 0
            not_generic = intent != "stop" and len(reply) > 20

            passed = keyword_match and no_bad_keywords and not_generic
            status = "PASS" if passed else "FAIL"

            if not keyword_match:
                print(f"  WARNING: No relevant keywords found. Expected at least one of: {campaign['must_mention']}")
            if not no_bad_keywords:
                print(f"  WARNING: Off-topic keywords found: {bad_keywords}")

            print(f"  Result:        {status} (matched: {matched_keywords})")
            results.append({"campaign": campaign["name"], "status": status, "reply": reply[:100], "intent": intent})

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({"campaign": campaign["name"], "status": "ERROR", "reply": str(e), "intent": "error"})

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    errors = sum(1 for r in results if r["status"] == "ERROR")
    print(f"  PASS: {passed}  |  FAIL: {failed}  |  ERROR: {errors}  |  Total: {len(results)}")
    for r in results:
        icon = "✓" if r["status"] == "PASS" else "✗" if r["status"] == "FAIL" else "!"
        print(f"  {icon} {r['campaign']}: {r['status']} — intent={r['intent']}")

    print()
    return 0 if failed == 0 and errors == 0 else 1


if __name__ == "__main__":
    sys.exit(run_tests())
