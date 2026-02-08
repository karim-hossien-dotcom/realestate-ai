"""
ai_inbound_agent.py

AI auto-reply webhook for WhatsApp Cloud API inbound messages.

- Reads incoming WhatsApp webhook payloads
- Uses OpenAI to classify intent + write a reply
- Handles STOP / unsubscribe safely
- Logs everything to inbound_log.csv

Env vars:
- WHATSAPP_VERIFY_TOKEN (for webhook verification)
- WHATSAPP_ACCESS_TOKEN (for sending replies; if missing, demo mode)
"""

import os
import csv
import json
import datetime as dt
import urllib.request
import urllib.error
from typing import Optional

from flask import Flask, request, jsonify
from openai import OpenAI

# ---------- CONFIG ----------
# You can change these or set them as environment variables.
AGENT_NAME = os.getenv("AGENT_NAME", "Nadine Khalil")
AGENT_BROKERAGE = os.getenv("AGENT_BROKERAGE", "KW Commercial")
LOG_FILE = os.getenv("INBOUND_LOG_FILE", "inbound_log.csv")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

# ---------- OPENAI CLIENT ----------
client = OpenAI()  # uses OPENAI_API_KEY env variable

# ---------- FLASK APP ----------
app = Flask(__name__)


def ensure_log_file_exists():
    """Create the inbound_log.csv file with headers if it does not exist."""
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "timestamp_utc",
                    "from_number",
                    "to_number",
                    "incoming_body",
                    "intent",
                    "reply",
                    "schedule_follow_up_days",
                    "notes",
                ]
            )


ensure_log_file_exists()


def is_stop_message(text: str) -> bool:
    """
    Basic STOP detection without using AI (required for compliance).
    """
    if not text:
        return False
    normalized = text.strip().lower()
    return normalized in {
        "stop",
        "unsubscribe",
        "cancel",
        "end",
        "quit",
        "stop all",
    }


def analyze_with_ai(
    owner_message: str,
    from_number: str,
    to_number: str,
    conversation_history: Optional[list] = None,
    lead_details: Optional[dict] = None,
) -> dict:
    """
    Call OpenAI to classify intent and generate a reply.
    Uses conversation history for context and lead details to track qualification.

    Returns a dict like:
    {
        "intent": "interested",
        "reply": "...",
        "schedule_follow_up_days": 3,
        "notes": "wants CMA first",
        "meeting": {...},
        "qualification": {...},
        "agent_brief": "..."
    }
    """

    # Build conversation context string
    convo_context = ""
    if conversation_history:
        convo_lines = []
        for msg in conversation_history[-15:]:  # last 15 messages
            role = "OWNER" if msg.get("direction") == "inbound" else AGENT_NAME.upper()
            convo_lines.append(f"{role}: {msg.get('body', '')}")
        convo_context = "\n".join(convo_lines)

    # Build known lead info
    known_info = ""
    if lead_details:
        parts = []
        if lead_details.get("owner_name"):
            parts.append(f"Name: {lead_details['owner_name']}")
        if lead_details.get("property_address"):
            parts.append(f"Property: {lead_details['property_address']}")
        if lead_details.get("property_type"):
            parts.append(f"Type: {lead_details['property_type']}")
        if lead_details.get("property_interest"):
            parts.append(f"Interest: {lead_details['property_interest']}")
        if lead_details.get("budget_min") or lead_details.get("budget_max"):
            parts.append(f"Budget: ${lead_details.get('budget_min', '?')} - ${lead_details.get('budget_max', '?')}")
        if lead_details.get("location_preference"):
            parts.append(f"Location: {lead_details['location_preference']}")
        if lead_details.get("email"):
            parts.append(f"Email: {lead_details['email']}")
        known_info = "\n".join(parts)

    today = dt.date.today().isoformat()
    current_year = dt.date.today().year

    system_prompt = f"""You are {AGENT_NAME}, a top-performing real estate agent at {AGENT_BROKERAGE}. You handle inbound WhatsApp conversations AUTONOMOUSLY to qualify leads and prepare them for a closing call with the agent.

TODAY'S DATE: {today}. The current year is {current_year}. ALWAYS use {current_year} for any dates you generate.

YOUR MISSION: Gather ALL missing information from the lead through natural conversation, then schedule a meeting once fully qualified. You are the agent's assistant who handles the entire intake process.

QUALIFICATION CHECKLIST - You must collect ALL of these before scheduling a meeting:
1. PROPERTY ADDRESS - Full street address
2. PROPERTY TYPE - Single family, condo, townhouse, multi-family, commercial, land
3. BEDROOMS / BATHROOMS - Number of each
4. SQUARE FOOTAGE - Approximate size
5. OWNER'S GOAL - Selling, buying, renting, investing, or getting a valuation
6. TIMELINE - When do they want to act? (ASAP, 1-3 months, 6+ months, just exploring)
7. PRICE EXPECTATION - What they think it's worth or their budget
8. MEETING DATE - Specific date
9. MEETING TIME - Specific time (NEVER assume a time - always ask)

CONVERSATION STRATEGY:
- Ask for 1-2 missing items per message MAX. Don't overwhelm with questions.
- Acknowledge what they've shared before asking for more.
- Provide value with each response - give market insight, appreciation estimates, neighborhood knowledge.
- Be specific: "A 5,000 sqft 3BR on Nick Nuccio Pkwy in Tampa is likely in the $X-Y range based on recent comps" is better than "the market is active."
- When they share property details, respond with genuine expertise about that specific property/area.
- If they give a date without a time, ask what time works best.
- If they give a time without a date, ask what date works.
- Only confirm the appointment once you have BOTH date AND time.

LEAD READINESS:
- Track what information you still need in the "missing_fields" array.
- When ALL 9 checklist items are gathered, set "qualified" to true.
- Generate an "agent_brief" summary ONLY when qualified - this is the prep document for {AGENT_NAME} before the call.

RULES:
- Keep replies under 500 characters. Be conversational, not robotic.
- Be warm, professional, and knowledgeable.
- NEVER give vague replies. Be SPECIFIC with market knowledge.
- Address their message directly, then ask for the next missing piece naturally.
- If they clearly do NOT want contact, mark intent "stop".
- DO NOT mention that you are an AI or an assistant. You ARE {AGENT_NAME}.
- Sign off as {AGENT_NAME}.

Return ONLY valid JSON:
{{
  "intent": "interested" | "not_interested" | "maybe_later" | "needs_more_info" | "wrong_person" | "stop" | "other",
  "reply": "your message to the lead",
  "schedule_follow_up_days": integer or null,
  "notes": "internal note about this interaction",
  "qualification": {{
    "property_address": "extracted address or null",
    "property_type": "extracted type or null",
    "bedrooms": integer or null,
    "bathrooms": integer or null,
    "sqft": integer or null,
    "owner_goal": "sell/buy/rent/invest/valuation or null",
    "timeline": "extracted timeline or null",
    "price_expectation": "extracted price or null",
    "meeting_date": "YYYY-MM-DD or null",
    "meeting_time": "HH:MM or null",
    "missing_fields": ["list of still-missing checklist items"],
    "qualified": true/false
  }},
  "meeting": {{
    "requested": true/false,
    "ready_to_book": true/false,
    "title": "Meeting with [name] - [property/topic]",
    "date_suggestion": "YYYY-MM-DDTHH:MM:SS or null",
    "property_address": "address or null",
    "description": "meeting purpose"
  }},
  "agent_brief": "ONLY when qualified=true: Full summary for {AGENT_NAME} including property details, owner motivation, price expectations, key talking points, and recommended approach for the call. Otherwise null."
}}

MEETING RULES:
- Set "requested" to true when the owner asks to meet/call/schedule.
- Set "ready_to_book" to true ONLY when you have BOTH a specific date AND time.
- Only set "date_suggestion" when ready_to_book is true.
- If they gave a date but no time, ask for time. Do NOT invent a time.
- If they gave a time but no date, ask for date.
"""

    # Build messages list with conversation history
    messages = [{"role": "system", "content": system_prompt}]

    context_parts = []
    if known_info:
        context_parts.append(f"KNOWN LEAD INFO:\n{known_info}")
    if convo_context:
        context_parts.append(f"CONVERSATION HISTORY:\n{convo_context}")

    context_str = "\n\n".join(context_parts)

    user_content = ""
    if context_str:
        user_content += f"{context_str}\n\n"
    user_content += (
        f"NEW MESSAGE FROM OWNER (phone: {from_number}):\n"
        f"{owner_message}\n\n"
        f"Respond ONLY with JSON as specified."
    )

    messages.append({"role": "user", "content": user_content})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        messages=messages,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {
            "intent": "other",
            "reply": (
                "Thanks for your message! I'll review it and follow up with a more "
                "detailed response shortly."
            ),
            "schedule_follow_up_days": None,
            "notes": f"JSON parse failed. Raw content: {raw[:200]}",
        }

    # Safety checks
    if "reply" not in data or not data["reply"]:
        data["reply"] = (
            "Thanks for your message! I'll review it and follow up with you shortly."
        )
    if "intent" not in data:
        data["intent"] = "other"
    if "schedule_follow_up_days" not in data:
        data["schedule_follow_up_days"] = None
    if "notes" not in data:
        data["notes"] = ""
    if "qualification" not in data:
        data["qualification"] = {}
    if "agent_brief" not in data:
        data["agent_brief"] = None

    return data


def generate_reply(owner_message: str, from_number: str, to_number: str) -> str:
    """
    Minimal wrapper for webhook apps: returns reply text only.
    """
    result = analyze_with_ai(owner_message, from_number, to_number)
    return result.get(
        "reply",
        "Thanks for your message! I’ll follow up with you shortly.",
    )


def log_inbound(
    from_number: str,
    to_number: str,
    incoming_body: str,
    intent: str,
    reply: str,
    schedule_follow_up_days,
    notes: str,
):
    """Append one row to inbound_log.csv."""
    timestamp = dt.datetime.utcnow().isoformat()
    with open(LOG_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                timestamp,
                from_number,
                to_number,
                incoming_body,
                intent,
                reply,
                schedule_follow_up_days,
                notes,
            ]
        )


@app.route("/health", methods=["GET"])
def health():
    # Health check for local wiring.
    return jsonify({"ok": True})


@app.route("/whatsapp/webhook", methods=["GET"])
def whatsapp_verify():
    """
    Meta webhook verification.
    """
    mode = request.args.get("hub.mode", "")
    token = request.args.get("hub.verify_token", "")
    challenge = request.args.get("hub.challenge", "")

    if mode == "subscribe" and token and token == WHATSAPP_VERIFY_TOKEN:
        return challenge, 200
    return "Forbidden", 403


def _post_whatsapp_message(phone_number_id: str, to_number: str, body: str) -> dict:
    url = f"https://graph.facebook.com/v20.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": body},
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


@app.route("/whatsapp/webhook", methods=["POST"])
def whatsapp_webhook():
    payload = request.get_json(silent=True) or {}
    entries = payload.get("entry") or []

    responses = []
    replies = []
    for entry in entries:
        changes = entry.get("changes") or []
        for change in changes:
            value = change.get("value") or {}
            messages = value.get("messages") or []
            phone_number_id = (
                value.get("metadata", {}).get("phone_number_id") or ""
            )

            for message in messages:
                from_number = message.get("from", "") or ""
                text_body = (
                    (message.get("text") or {}).get("body") or ""
                )

                if not from_number or not text_body:
                    continue

                if is_stop_message(text_body):
                    auto_reply = (
                        "You’re unsubscribed. You won’t receive any further messages. "
                        "Thank you for letting us know."
                    )
                    log_inbound(
                        from_number=from_number,
                        to_number=phone_number_id,
                        incoming_body=text_body,
                        intent="stop",
                        reply=auto_reply,
                        schedule_follow_up_days=None,
                        notes="STOP detected - do not contact",
                    )
                    responses.append({"from": from_number, "stop": True})
                    continue

                ai_result = analyze_with_ai(text_body, from_number, phone_number_id)
                reply_text = ai_result.get(
                    "reply",
                    "Thanks for your message! I’ll follow up with you shortly.",
                )
                intent = ai_result.get("intent", "other")
                schedule_follow_up_days = ai_result.get("schedule_follow_up_days")
                notes = ai_result.get("notes", "")

                log_inbound(
                    from_number=from_number,
                    to_number=phone_number_id,
                    incoming_body=text_body,
                    intent=intent,
                    reply=reply_text,
                    schedule_follow_up_days=schedule_follow_up_days,
                    notes=notes,
                )
                replies.append(reply_text)

                if not WHATSAPP_ACCESS_TOKEN:
                    responses.append({"from": from_number, "demo": True, "reply": reply_text})
                    continue

                try:
                    api_resp = _post_whatsapp_message(
                        phone_number_id=phone_number_id,
                        to_number=from_number,
                        body=reply_text,
                    )
                    responses.append({"from": from_number, "reply": reply_text, "api": api_resp})
                except urllib.error.HTTPError as err:
                    responses.append({"from": from_number, "error": f"http {err.code}"})
                except Exception as err:
                    responses.append({"from": from_number, "error": str(err)})

    if not WHATSAPP_ACCESS_TOKEN:
        return jsonify(
            {
                "ok": True,
                "demo": True,
                "reply": replies[0] if replies else "",
                "responses": responses,
            }
        )

    return jsonify({"ok": True, "responses": responses, "demo": False})


if __name__ == "__main__":
    # For local testing
    app.run(host="0.0.0.0", port=5001, debug=True)
