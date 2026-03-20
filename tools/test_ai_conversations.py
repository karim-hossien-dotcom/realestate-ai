"""
AI Conversation Quality Test
Simulates realistic WhatsApp conversations and shows the AI's responses.
Tests the actual analyze_with_ai() function with gpt-4o.

Usage: cd tools && python test_ai_conversations.py
"""

import os
import sys
import json

# Load env vars
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Import the AI function
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from tools.ai_inbound_agent import analyze_with_ai

AGENT_NAME = "Nadine Khalil"
AGENT_BROKERAGE = "KW Commercial"

def run_conversation(title, messages):
    """Simulate a multi-turn conversation and print results."""
    print(f"\n{'='*70}")
    print(f"  SCENARIO: {title}")
    print(f"{'='*70}")

    conversation_history = []
    lead_details = None

    for i, msg in enumerate(messages):
        user_text = msg["text"]
        # Allow overriding lead details mid-conversation
        if "lead_details" in msg:
            lead_details = msg["lead_details"]

        print(f"\n  LEAD: {user_text}")

        result = analyze_with_ai(
            owner_message=user_text,
            from_number="+13475551234",
            to_number="+18484569428",
            conversation_history=conversation_history,
            lead_details=lead_details,
            agent_name=AGENT_NAME,
            agent_brokerage=AGENT_BROKERAGE,
        )

        reply = result.get("reply", "")
        intent = result.get("intent", "")
        notes = result.get("notes", "")
        qual = result.get("qualification", {})
        meeting = result.get("meeting", {})

        print(f"  AI:   {reply}")
        print(f"        [intent={intent}] [notes={notes[:80]}]")

        if qual.get("property_address"):
            print(f"        [extracted: address={qual['property_address']}, type={qual.get('property_type')}, goal={qual.get('owner_goal')}]")
        if meeting.get("requested"):
            print(f"        [meeting: requested={meeting['requested']}, ready={meeting.get('ready_to_book')}, date={meeting.get('date_suggestion')}]")

        # Add to conversation history for next turn
        conversation_history.append({"direction": "inbound", "body": user_text})
        conversation_history.append({"direction": "outbound", "body": reply})

        # Update lead_details from qualification if extracted
        if qual:
            if not lead_details:
                lead_details = {}
            if qual.get("property_address"):
                lead_details["property_address"] = qual["property_address"]
            if qual.get("property_type"):
                lead_details["property_type"] = qual["property_type"]
            if qual.get("owner_goal"):
                lead_details["property_interest"] = qual["owner_goal"]


# ============================================================
# TEST SCENARIOS
# ============================================================

print("\n" + "🔥"*35)
print("  AI CONVERSATION QUALITY TEST")
print("  Model: gpt-4o | Agent: Nadine Khalil | KW Commercial")
print("🔥"*35)

# --- Scenario 1: Seller with commercial property ---
run_conversation("SELLER — Commercial property in Hoboken", [
    {"text": "Hi I have a commercial building in Hoboken I'm thinking of selling"},
    {"text": "It's at 450 Washington St, about 8000 sqft, mixed use with 3 retail tenants"},
    {"text": "I'm hoping to get around 4.5 million"},
    {"text": "Ideally within the next 2-3 months"},
])

# --- Scenario 2: Buyer looking for property ---
run_conversation("BUYER — Looking to purchase", [
    {"text": "Hey I'm looking to buy a commercial space for my restaurant"},
    {"text": "Somewhere in downtown Tampa, budget around 800K"},
    {"text": "Around 2000-3000 sqft with good foot traffic"},
    {"text": "I'd like to move on this pretty quickly, within a month if possible"},
])

# --- Scenario 3: "Thanks" should NOT trigger stop ---
run_conversation("THANKS — Should NOT unsubscribe", [
    {"text": "Can you tell me more about what you do?"},
    {"text": "Ok that sounds interesting. Let me think about it"},
    {"text": "Thanks"},
])

# --- Scenario 4: Not interested → pivot ---
run_conversation("NOT INTERESTED — Pivot to investment", [
    {"text": "Not really looking to sell right now"},
    {"text": "No I'm happy where I am"},
    {"text": "Actually yeah I've been thinking about investment properties"},
])

# --- Scenario 5: New appointment vs reschedule ---
run_conversation("NEW APPOINTMENT — Not a reschedule", [
    {"text": "Hey I want to schedule a new meeting about my property on 789 Ocean Drive Miami",
     "lead_details": {
         "owner_name": "Carlos",
         "property_address": "123 Main St, Newark, NJ",
         "status": "meeting_scheduled",
         "notes": "Previous meeting completed last week"
     }},
    {"text": "No this is a NEW property, different from the one we discussed before"},
    {"text": "Next Tuesday at 3pm works for me"},
])

# --- Scenario 6: Expired listing ---
run_conversation("EXPIRED LISTING — Property didn't sell", [
    {"text": "My property was listed for 6 months and didn't sell. I'm frustrated"},
    {"text": "The agent just put it on MLS and waited. No marketing, no outreach."},
    {"text": "I haven't signed with anyone new yet"},
])

# --- Scenario 7: Where did you get my number ---
run_conversation("WHERE'D YOU GET MY NUMBER — Suspicious lead", [
    {"text": "Who is this? How did you get my number?"},
    {"text": "Ok fine. What exactly are you offering?"},
    {"text": "I might be interested, my building is at 55 Broad St NYC"},
])

# --- Scenario 8: STOP message (should actually stop) ---
run_conversation("STOP — Actual opt-out", [
    {"text": "Stop texting me"},
])

print(f"\n{'='*70}")
print("  ALL SCENARIOS COMPLETE")
print(f"{'='*70}\n")
