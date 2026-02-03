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


def analyze_with_ai(owner_message: str, from_number: str, to_number: str) -> dict:
    """
    Call OpenAI to classify intent and generate a reply.

    Returns a dict like:
    {
        "intent": "interested",
        "reply": "...",
        "schedule_follow_up_days": 3,
        "notes": "wants CMA first"
    }
    """
    system_prompt = f"""
You are an SMS assistant for a commercial real estate agent named {AGENT_NAME} from {AGENT_BROKERAGE}.
Your job is to:
1. Understand the property owner's reply.
2. Decide their intent.
3. Write a short, friendly SMS reply.
4. Suggest if/when we should follow up.

Rules:
- Keep replies under 480 characters.
- Always be respectful and conversational.
- If the owner seems interested, try to move towards a short call or meeting.
- If they clearly do NOT want further contact, mark intent "stop" and set schedule_follow_up_days to null.
- If they say maybe later, choose a realistic follow-up window (e.g., 14, 30, 60 days).
- DO NOT mention that you are an AI.

Return ONLY valid JSON with this structure:
{{
  "intent": "interested" | "not_interested" | "maybe_later" | "needs_more_info" | "wrong_person" | "stop" | "other",
  "reply": "string",
  "schedule_follow_up_days": integer or null,
  "notes": "short internal note for the agent"
}}
"""

    user_payload = {
        "from_number": from_number,
        "to_number": to_number,
        "owner_message": owner_message,
    }

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.3,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Here is the latest SMS reply from the property owner. "
                    "Respond ONLY with JSON as specified.\n\n"
                    + json.dumps(user_payload)
                ),
            },
        ],
    )

    raw = response.choices[0].message.content.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback if the model returns something weird
        data = {
            "intent": "other",
            "reply": (
                "Thanks for your message! I’ll review it and follow up with a more "
                "detailed response shortly."
            ),
            "schedule_follow_up_days": None,
            "notes": f"JSON parse failed. Raw content: {raw[:200]}",
        }

    # Basic safety checks
    if "reply" not in data or not data["reply"]:
        data["reply"] = (
            "Thanks for your message! I’ll review it and follow up with you shortly."
        )
    if "intent" not in data:
        data["intent"] = "other"
    if "schedule_follow_up_days" not in data:
        data["schedule_follow_up_days"] = None
    if "notes" not in data:
        data["notes"] = ""

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
