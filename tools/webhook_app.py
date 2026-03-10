import os
import csv
import json
from datetime import datetime, timezone
from typing import Iterable, Optional

import fcntl
import requests
from flask import Flask, request, Response, jsonify

from tools.ai_inbound_agent import generate_reply, analyze_with_ai, is_stop_message

# Import Supabase DB functions (optional - falls back to CSV if not configured)
try:
    from tools.db import (
        log_inbound_message,
        log_outbound_message,
        add_to_dnc_list,
        is_on_dnc_list,
        remove_from_dnc_list,
        log_activity,
        find_lead_by_phone,
        find_user_by_lead_phone,
        get_user_profile,
        update_lead_last_response,
        get_default_user_id,
        create_meeting,
        get_conversation_history,
        get_lead_details,
        get_supabase_client,
        create_follow_up,
    )
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False


app = Flask(__name__)

# ---------- Rate Limiting ----------
# Simple IP-based rate limiter — no external dependency needed
_RATE_LIMIT_STORE: dict[str, list[float]] = {}
_RATE_LIMIT_MAX = 60          # max requests per window
_RATE_LIMIT_WINDOW = 60.0     # window in seconds (1 minute)


def _is_rate_limited(ip: str) -> bool:
    """Returns True if this IP has exceeded the rate limit."""
    import time
    now = time.time()
    hits = _RATE_LIMIT_STORE.get(ip, [])
    # Remove timestamps outside the window
    hits = [t for t in hits if now - t < _RATE_LIMIT_WINDOW]
    if len(hits) >= _RATE_LIMIT_MAX:
        _RATE_LIMIT_STORE[ip] = hits
        return True
    hits.append(now)
    _RATE_LIMIT_STORE[ip] = hits
    return False


# Message deduplication: track processed message IDs (in-memory LRU cache)
# Meta retries webhook delivery, which can cause duplicate processing
_PROCESSED_MSG_IDS: dict[str, float] = {}
_MAX_CACHED_IDS = 10000
_DEDUP_WINDOW_SECONDS = 3600  # 1 hour


def _is_duplicate_message(msg_id: str) -> bool:
    """Check if we've already processed this message_id. Returns True if duplicate."""
    import time

    if not msg_id:
        return False

    now = time.time()

    # Clean old entries if cache is too large
    if len(_PROCESSED_MSG_IDS) > _MAX_CACHED_IDS:
        cutoff = now - _DEDUP_WINDOW_SECONDS
        expired = [k for k, v in _PROCESSED_MSG_IDS.items() if v < cutoff]
        for k in expired:
            del _PROCESSED_MSG_IDS[k]

    if msg_id in _PROCESSED_MSG_IDS:
        return True

    _PROCESSED_MSG_IDS[msg_id] = now
    return False

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
INBOUND_LOG = os.path.join(LOG_DIR, "inbound.csv")
OUTBOUND_LOG = os.path.join(LOG_DIR, "outbound.csv")
STOPPED_LOG = os.path.join(LOG_DIR, "stopped.csv")

os.makedirs(LOG_DIR, exist_ok=True)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _write_csv_row(path: str, headers: Iterable[str], row: dict) -> None:
    _ensure_dir(LOG_DIR)
    file_exists = os.path.exists(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        writer = csv.DictWriter(f, fieldnames=list(headers))
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)
        f.flush()
        os.fsync(f.fileno())
        fcntl.flock(f, fcntl.LOCK_UN)


def _extract_messages(payload: dict) -> list[dict]:
    entries = payload.get("entry") or []
    messages_out: list[dict] = []
    for entry in entries:
        changes = entry.get("changes") or []
        for change in changes:
            value = change.get("value") or {}
            messages = value.get("messages") or []
            for message in messages:
                wa_id = message.get("from", "") or ""
                msg_id = message.get("id") or ""
                timestamp = message.get("timestamp") or ""
                msg_type = message.get("type", "text")

                if msg_type == "text":
                    body = (message.get("text") or {}).get("body") or ""
                else:
                    # Non-text message (voice, image, video, document, etc.)
                    body = ""

                messages_out.append(
                    {
                        "wa_id": wa_id,
                        "body": body,
                        "message_id": msg_id,
                        "timestamp": timestamp,
                        "type": msg_type,
                    }
                )
    return messages_out


def _send_whatsapp_message(to_number: str, body: str) -> dict:
    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        return {"ok": True, "demo": True}

    url = f"https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": body},
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=10)
    return {"ok": resp.ok, "status": resp.status_code, "body": resp.text}


def _get_user_id() -> Optional[str]:
    """Get the user ID to associate with messages (legacy fallback)"""
    if SUPABASE_AVAILABLE:
        return get_default_user_id()
    return None


def _resolve_user_context(phone: str) -> dict:
    """
    Resolve which agent owns a lead by searching across all users.
    Returns {user_id, agent_name, agent_brokerage, agent_phone, agent_email}.
    Falls back to env vars + first user if lead not found.
    """
    default_name = os.getenv("AGENT_NAME", "Your Agent")
    default_brokerage = os.getenv("AGENT_BROKERAGE", "Estate AI")
    default_phone = os.getenv("AGENT_PHONE")
    default_email = os.getenv("AGENT_EMAIL")

    fallback = {
        "user_id": _get_user_id(),
        "agent_name": default_name,
        "agent_brokerage": default_brokerage,
        "agent_phone": default_phone,
        "agent_email": default_email,
    }

    if not SUPABASE_AVAILABLE:
        return fallback

    match = find_user_by_lead_phone(phone)
    if not match or not match.get("user_id"):
        return fallback

    owner_id = match["user_id"]
    profile = get_user_profile(owner_id)
    if not profile:
        return {**fallback, "user_id": owner_id}

    return {
        "user_id": owner_id,
        "agent_name": profile.get("full_name") or default_name,
        "agent_brokerage": profile.get("company") or default_brokerage,
        "agent_phone": profile.get("phone") or default_phone,
        "agent_email": profile.get("email") or default_email,
    }


def _update_lead_from_qualification(
    user_id: str,
    wa_id: str,
    qualification: dict,
    ai_result: dict,
) -> None:
    """Update the lead record with information extracted by AI during qualification."""
    if not SUPABASE_AVAILABLE:
        return

    lead = find_lead_by_phone(user_id, wa_id)
    if not lead:
        return

    updates = {}
    if qualification.get("property_address") and not lead.get("property_address"):
        updates["property_address"] = qualification["property_address"]
    if qualification.get("property_type") and not lead.get("property_type"):
        updates["property_type"] = qualification["property_type"]
    if qualification.get("owner_goal") and not lead.get("property_interest"):
        updates["property_interest"] = qualification["owner_goal"]
    if qualification.get("price_expectation") and not lead.get("budget_max"):
        # Try to parse a number from the price expectation (handles $300K, $1.5M, etc.)
        try:
            price_str = qualification["price_expectation"].replace("$", "").replace(",", "").strip()
            multiplier = 1
            if price_str.upper().endswith("K"):
                multiplier = 1_000
                price_str = price_str[:-1]
            elif price_str.upper().endswith("M"):
                multiplier = 1_000_000
                price_str = price_str[:-1]
            elif price_str.upper().endswith("B"):
                multiplier = 1_000_000_000
                price_str = price_str[:-1]
            price_val = int(float(price_str) * multiplier)
            updates["budget_max"] = price_val
        except (ValueError, AttributeError):
            pass
    if qualification.get("sqft"):
        notes = lead.get("notes") or ""
        sqft_note = f"Sqft: {qualification['sqft']}"
        if sqft_note not in notes:
            updates["notes"] = f"{notes}\n{sqft_note}".strip() if notes else sqft_note
    if qualification.get("bedrooms"):
        notes = updates.get("notes") or lead.get("notes") or ""
        bed_note = f"Beds: {qualification['bedrooms']}"
        if bed_note not in notes:
            updates["notes"] = f"{notes}\n{bed_note}".strip() if notes else bed_note

    # Save agent brief to lead notes when qualified
    agent_brief = ai_result.get("agent_brief")
    if agent_brief:
        notes = updates.get("notes") or lead.get("notes") or ""
        brief_header = "--- AI QUALIFICATION BRIEF ---"
        if brief_header not in notes:
            updates["notes"] = f"{notes}\n\n{brief_header}\n{agent_brief}".strip()

    if updates:
        try:
            client = get_supabase_client()
            if client:
                client.table("leads").update(updates).eq("id", lead["id"]).execute()
        except Exception as e:
            print(f"Error updating lead from qualification: {e}")


def _log_to_supabase(
    user_id: Optional[str],
    wa_id: str,
    body: str,
    msg_id: str,
    direction: str = "inbound",
    reply_text: Optional[str] = None,
    send_status: Optional[str] = None,
) -> None:
    """Log message to Supabase if available"""
    if not SUPABASE_AVAILABLE or not user_id:
        return

    # Find associated lead
    lead = find_lead_by_phone(user_id, wa_id)
    lead_id = lead["id"] if lead else None

    if direction == "inbound":
        log_inbound_message(
            user_id=user_id,
            from_number=wa_id,
            body=body,
            external_id=msg_id,
            lead_id=lead_id,
        )

        # Update lead's last_response timestamp
        if lead_id:
            update_lead_last_response(lead_id)

    elif direction == "outbound" and reply_text:
        log_outbound_message(
            user_id=user_id,
            to_number=wa_id,
            body=reply_text,
            status=send_status or "sent",
            lead_id=lead_id,
        )


@app.route("/health", methods=["GET"])
def health():
    checks = {}
    overall = "healthy"

    # Check Supabase connectivity
    try:
        from tools.db import get_supabase_client
        client = get_supabase_client()
        if client:
            result = client.table("profiles").select("id").limit(1).execute()
            checks["database"] = {"status": "healthy"}
        else:
            checks["database"] = {"status": "unhealthy", "error": "Supabase not configured"}
            overall = "degraded"
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        overall = "degraded"

    # Check OpenAI API key presence
    openai_key = os.getenv("OPENAI_API_KEY")
    checks["openai"] = (
        {"status": "healthy"}
        if openai_key
        else {"status": "degraded", "error": "OPENAI_API_KEY not set"}
    )
    if not openai_key:
        overall = "degraded"

    # Check WhatsApp token presence
    wa_token = os.getenv("WHATSAPP_TOKEN")
    checks["whatsapp"] = (
        {"status": "healthy"}
        if wa_token
        else {"status": "degraded", "error": "WHATSAPP_TOKEN not set"}
    )
    if not wa_token:
        overall = "degraded"

    status_code = 200 if overall == "healthy" else 503
    return jsonify({
        "status": overall,
        "service": "estate-ai-python-webhook",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }), status_code


@app.route("/webhook", methods=["GET"], strict_slashes=False)
def webhook_verify():
    mode = request.args.get("hub.mode", "")
    token = request.args.get("hub.verify_token", "")
    challenge = request.args.get("hub.challenge", "")

    if mode == "subscribe" and token and token == WHATSAPP_VERIFY_TOKEN:
        return Response(challenge, status=200, mimetype="text/plain")

    return Response("Forbidden", status=403, mimetype="text/plain")


@app.route("/webhook", methods=["POST"], strict_slashes=False)
def webhook_inbound():
    # Rate limiting
    client_ip = request.remote_addr or "unknown"
    if _is_rate_limited(client_ip):
        return Response("Rate limit exceeded", status=429)

    payload = request.get_json(silent=True) or {}
    messages = _extract_messages(payload)

    now = datetime.now(timezone.utc).isoformat()

    for msg in messages:
        wa_id = msg["wa_id"]
        body = msg["body"]
        msg_id = msg["message_id"]
        ts = msg["timestamp"]

        # Deduplication: skip if we've already processed this message
        if _is_duplicate_message(msg_id):
            print(f"Skipping duplicate message {msg_id} from {wa_id}")
            continue

        # Resolve which agent owns this lead (multi-tenant routing)
        ctx = _resolve_user_context(wa_id)
        user_id = ctx["user_id"]
        agent_name = ctx["agent_name"]
        agent_brokerage = ctx["agent_brokerage"]
        agent_phone = ctx["agent_phone"]
        agent_email = ctx["agent_email"]

        msg_type = msg.get("type", "text")

        # Handle non-text messages (voice, image, video, etc.)
        if msg_type != "text":
            type_labels = {
                "image": "photo",
                "video": "video",
                "audio": "voice note",
                "voice": "voice note",
                "document": "document",
                "sticker": "sticker",
                "location": "location",
                "contacts": "contact card",
            }
            label = type_labels.get(msg_type, "message")
            ack_reply = (
                f"Thanks for sending that {label}! I'm currently only able to read text messages. "
                f"Could you describe what you'd like to share in a text message? "
                f"I'm here to help! - {agent_name}"
            )
            _send_whatsapp_message(wa_id, ack_reply)

            # Log to Supabase
            _log_to_supabase(user_id, wa_id, f"[{msg_type} message]", msg_id, "inbound")
            _log_to_supabase(user_id, wa_id, f"[{msg_type} message]", msg_id, "outbound",
                             reply_text=ack_reply, send_status="sent")

            if SUPABASE_AVAILABLE and user_id:
                log_activity(
                    user_id,
                    "message_reply",
                    f"Acknowledged {msg_type} message from {wa_id}",
                    "sent",
                    {"phone": wa_id, "type": msg_type, "direction": "inbound"},
                )
            continue

        # Log to CSV (always, for backup)
        _write_csv_row(
            INBOUND_LOG,
            ["timestamp_utc", "wa_id", "message_id", "message_ts", "body"],
            {
                "timestamp_utc": now,
                "wa_id": wa_id,
                "message_id": msg_id,
                "message_ts": ts,
                "body": body,
            },
        )

        # Log to Supabase
        _log_to_supabase(user_id, wa_id, body, msg_id, "inbound")

        # Log inbound to activity_logs
        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id,
                "message_reply",
                f"Inbound WhatsApp from {wa_id}: {body[:100]}",
                "received",
                {"phone": wa_id, "message": body, "direction": "inbound"},
            )

        # Re-engagement: if a DNC-listed number sends a non-STOP message, re-opt-in
        if SUPABASE_AVAILABLE and user_id and not is_stop_message(body) and is_on_dnc_list(user_id, wa_id):
            remove_from_dnc_list(user_id, wa_id)
            log_activity(
                user_id,
                "re_opt_in",
                f"User {wa_id} re-engaged after previous opt-out — removed from DNC",
                "success",
                {"phone": wa_id, "message": body},
            )

        # Handle STOP messages
        if is_stop_message(body):
            _write_csv_row(
                STOPPED_LOG,
                ["timestamp_utc", "wa_id", "message_id", "message_ts", "body"],
                {
                    "timestamp_utc": now,
                    "wa_id": wa_id,
                    "message_id": msg_id,
                    "message_ts": ts,
                    "body": body,
                },
            )

            # Add to DNC list in Supabase
            if SUPABASE_AVAILABLE and user_id:
                add_to_dnc_list(user_id, wa_id, "STOP keyword via webhook")
                log_activity(
                    user_id,
                    "opt_out",
                    f"User {wa_id} opted out via STOP keyword",
                    "success",
                    {"phone": wa_id, "message": body},
                )

            _send_whatsapp_message(
                wa_id,
                "You're unsubscribed. You won't receive any further messages. "
                "Thank you for letting us know.",
            )
            continue

        # Fetch conversation history and lead details for context
        conversation_history = []
        lead_details = None
        if SUPABASE_AVAILABLE and user_id:
            conversation_history = get_conversation_history(user_id, wa_id)
            lead_details = get_lead_details(user_id, wa_id)

        # Generate AI reply with full analysis + conversation context
        ai_result = analyze_with_ai(
            body, wa_id, WHATSAPP_PHONE_NUMBER_ID,
            conversation_history=conversation_history,
            lead_details=lead_details,
            agent_name=agent_name,
            agent_brokerage=agent_brokerage,
        )

        # If AI detects escalation need, notify the agent
        if ai_result.get("intent") == "escalate":
            escalation_reply = ai_result.get(
                "reply",
                "I hear you, and I want to make sure this is handled properly. "
                "Let me review the details and get back to you directly."
            )
            _send_whatsapp_message(wa_id, escalation_reply)

            # Notify agent via WhatsApp if agent phone is available
            if agent_phone:
                agent_msg = (
                    f"ESCALATION NEEDED\n"
                    f"Lead: {wa_id}\n"
                    f"Message: {body[:200]}\n"
                    f"AI Notes: {ai_result.get('notes', 'N/A')}\n"
                    f"Please follow up directly."
                )
                _send_whatsapp_message(agent_phone, agent_msg)

            if SUPABASE_AVAILABLE and user_id:
                log_activity(
                    user_id,
                    "escalation",
                    f"Lead {wa_id} escalated to agent: {body[:100]}",
                    "pending",
                    {"phone": wa_id, "message": body, "notes": ai_result.get("notes")},
                )

            # Log messages to Supabase
            _log_to_supabase(user_id, wa_id, body, msg_id, "outbound",
                             reply_text=escalation_reply, send_status="sent")
            continue

        # If AI detects stop intent, treat as opt-out
        if ai_result.get("intent") == "stop":
            if SUPABASE_AVAILABLE and user_id:
                add_to_dnc_list(user_id, wa_id, "AI-detected stop intent")
                log_activity(
                    user_id,
                    "opt_out",
                    f"User {wa_id} opted out (AI-detected intent)",
                    "success",
                    {"phone": wa_id, "message": body},
                )
            _send_whatsapp_message(
                wa_id,
                "You're unsubscribed. You won't receive any further messages. "
                "Thank you for letting us know.",
            )
            continue

        reply_text = ai_result.get("reply", "Thanks for your message! I'll follow up shortly.")

        # DNC send-side check: never send to numbers on the DNC list
        if SUPABASE_AVAILABLE and user_id and is_on_dnc_list(user_id, wa_id):
            print(f"Blocked outbound to DNC number {wa_id}")
            log_activity(
                user_id,
                "dnc_blocked",
                f"Blocked outbound message to DNC number {wa_id}",
                "blocked",
                {"phone": wa_id, "reason": "on_dnc_list"},
            )
            continue

        send_result = _send_whatsapp_message(wa_id, reply_text)

        # Update lead with qualification data extracted by AI
        qualification = ai_result.get("qualification", {})
        if qualification and SUPABASE_AVAILABLE and user_id:
            _update_lead_from_qualification(user_id, wa_id, qualification, ai_result)

        # Create meeting ONLY when ready_to_book (has both date and time)
        meeting_data = ai_result.get("meeting", {})
        if meeting_data.get("ready_to_book") and meeting_data.get("date_suggestion") and SUPABASE_AVAILABLE and user_id:
            lead = find_lead_by_phone(user_id, wa_id) if user_id else None
            create_meeting(
                user_id=user_id,
                title=meeting_data.get("title", f"Meeting with {wa_id}"),
                lead_phone=wa_id,
                lead_name=lead.get("owner_name") if lead else None,
                lead_id=lead.get("id") if lead else None,
                description=meeting_data.get("description"),
                meeting_date=meeting_data.get("date_suggestion"),
                property_address=meeting_data.get("property_address") or qualification.get("property_address"),
                notes=ai_result.get("agent_brief") or ai_result.get("notes", ""),
                source="ai_bot",
            )
            if user_id:
                log_activity(
                    user_id, "meeting_created",
                    f"AI bot created meeting: {meeting_data.get('title', 'Meeting')}",
                    "success",
                    {"phone": wa_id, "meeting": meeting_data, "qualification": qualification},
                )

            # Auto-create day-before confirmation follow-up
            if meeting_data.get("date_suggestion") and lead:
                try:
                    from datetime import timedelta
                    meeting_dt = datetime.fromisoformat(
                        meeting_data["date_suggestion"].replace("Z", "+00:00")
                    )
                    confirm_dt = meeting_dt - timedelta(days=1)
                    lead_name = lead.get("owner_name", "there")
                    confirm_msg = (
                        f"Hi {lead_name}, just a reminder about our meeting tomorrow "
                        f"at {meeting_dt.strftime('%I:%M %p')} regarding your property "
                        f"at {meeting_data.get('property_address', 'your property')}. "
                        f"Looking forward to speaking with you! - {agent_name}"
                    )
                    create_follow_up(
                        user_id=user_id,
                        lead_id=lead.get("id"),
                        message_text=confirm_msg,
                        scheduled_at=confirm_dt.isoformat(),
                        channel="whatsapp",
                    )
                    log_activity(
                        user_id, "followup",
                        f"Auto-created meeting confirmation for day before: {confirm_dt.date()}",
                        "success",
                        {"phone": wa_id, "meeting_date": meeting_data["date_suggestion"]},
                    )
                except Exception as e:
                    print(f"Error creating confirmation follow-up: {e}")

        # Auto-create follow-up when AI sets schedule_follow_up_days
        follow_up_days = ai_result.get("schedule_follow_up_days")
        if follow_up_days and isinstance(follow_up_days, (int, float)) and follow_up_days > 0 and SUPABASE_AVAILABLE and user_id:
            try:
                from datetime import timedelta
                lead = find_lead_by_phone(user_id, wa_id)
                if lead:
                    follow_up_dt = datetime.now(timezone.utc) + timedelta(days=int(follow_up_days))
                    lead_name = lead.get("owner_name", "there").split(" ")[0]

                    # Build a context-aware follow-up using AI notes
                    ai_notes = ai_result.get("notes", "")
                    qualification = ai_result.get("qualification", {})
                    property_addr = qualification.get("property_address") or lead.get("property_address") or ""
                    owner_goal = qualification.get("owner_goal") or ""

                    if ai_notes and ("interest" in ai_notes.lower() or "looking" in ai_notes.lower() or "buy" in ai_notes.lower() or "invest" in ai_notes.lower()):
                        # AI captured future interest — use it
                        follow_up_msg = (
                            f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. "
                            f"We spoke a few months back and you mentioned you'd be ready around now. "
                            f"I've been keeping an eye on the market for you — "
                            f"I have some opportunities that might match what you're looking for. "
                            f"Would you have time for a quick call this week?"
                        )
                    elif property_addr:
                        follow_up_msg = (
                            f"Hi {lead_name}, it's {agent_name}. "
                            f"We chatted a while back about your property at {property_addr}. "
                            f"The market has had some interesting movement since then — "
                            f"happy to share an updated analysis if you're curious. "
                            f"Are you still thinking about {owner_goal or 'your options'}?"
                        )
                    else:
                        follow_up_msg = (
                            f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. "
                            f"We connected a few months ago and you mentioned checking back around now. "
                            f"I'd love to catch up and see if I can help. "
                            f"Would you have a few minutes this week?"
                        )

                    create_follow_up(
                        user_id=user_id,
                        lead_id=lead.get("id"),
                        message_text=follow_up_msg,
                        scheduled_at=follow_up_dt.isoformat(),
                        channel="whatsapp",
                    )
                    log_activity(
                        user_id, "followup",
                        f"Auto-scheduled follow-up in {follow_up_days} days for {wa_id} (notes: {ai_notes[:100]})",
                        "success",
                        {"phone": wa_id, "follow_up_days": follow_up_days, "scheduled_at": follow_up_dt.isoformat(), "ai_notes": ai_notes},
                    )
            except Exception as e:
                print(f"Error creating scheduled follow-up: {e}")

        # Log agent brief when lead is fully qualified
        agent_brief = ai_result.get("agent_brief")
        if agent_brief and SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id, "lead_qualified",
                f"Lead {wa_id} fully qualified by AI bot",
                "success",
                {
                    "phone": wa_id,
                    "agent_brief": agent_brief,
                    "qualification": qualification,
                },
            )

        # Log outbound to CSV
        _write_csv_row(
            OUTBOUND_LOG,
            ["timestamp_utc", "wa_id", "message_id", "reply", "send_status", "send_body"],
            {
                "timestamp_utc": now,
                "wa_id": wa_id,
                "message_id": msg_id,
                "reply": reply_text,
                "send_status": send_result.get("status")
                or ("demo" if send_result.get("demo") else ""),
                "send_body": send_result.get("body") or "",
            },
        )

        # Log outbound to Supabase
        send_status = "sent" if send_result.get("ok") else "failed"
        _log_to_supabase(
            user_id, wa_id, body, msg_id, "outbound",
            reply_text=reply_text, send_status=send_status
        )

        # Log AI bot reply to activity_logs
        if SUPABASE_AVAILABLE and user_id:
            intent = ai_result.get("intent", "other")
            log_activity(
                user_id,
                "message_reply",
                f"AI bot replied to {wa_id} (intent: {intent}): {reply_text[:100]}",
                send_status,
                {
                    "phone": wa_id,
                    "reply": reply_text,
                    "intent": intent,
                    "direction": "outbound",
                    "follow_up_days": ai_result.get("schedule_follow_up_days"),
                },
            )

    return jsonify({"ok": True})


def _send_sms_message(to_number: str, body: str) -> dict:
    """Send an SMS via Twilio REST API."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
        return {"ok": True, "demo": True}

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    data = {
        "To": to_number if to_number.startswith("+") else f"+{to_number}",
        "From": TWILIO_PHONE_NUMBER,
        "Body": body,
    }
    resp = requests.post(
        url,
        data=data,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
        timeout=10,
    )
    return {"ok": resp.ok, "status": resp.status_code, "sid": resp.json().get("sid") if resp.ok else None}


def _log_sms_to_supabase(
    user_id: Optional[str],
    phone: str,
    body: str,
    direction: str = "inbound",
    reply_text: Optional[str] = None,
    send_status: Optional[str] = None,
) -> None:
    """Log SMS message to Supabase."""
    if not SUPABASE_AVAILABLE or not user_id:
        return

    lead = find_lead_by_phone(user_id, phone)
    lead_id = lead["id"] if lead else None

    if direction == "inbound":
        log_inbound_message(
            user_id=user_id,
            from_number=phone,
            body=body,
            external_id=None,
            lead_id=lead_id,
            channel="sms",
        )
        if lead_id:
            update_lead_last_response(lead_id)
    elif direction == "outbound" and reply_text:
        log_outbound_message(
            user_id=user_id,
            to_number=phone,
            body=reply_text,
            status=send_status or "sent",
            lead_id=lead_id,
            channel="sms",
        )


@app.route("/sms", methods=["POST"], strict_slashes=False)
def sms_inbound():
    """Handle inbound SMS from Twilio webhook."""
    # Rate limiting
    client_ip = request.remote_addr or "unknown"
    if _is_rate_limited(client_ip):
        return Response("Rate limit exceeded", status=429)

    # Twilio sends form-encoded data
    from_number = request.form.get("From", "").lstrip("+")
    body = request.form.get("Body", "").strip()
    msg_sid = request.form.get("MessageSid", "")

    if not from_number or not body:
        return Response("", status=200, mimetype="text/plain")

    # Deduplication
    if _is_duplicate_message(msg_sid):
        print(f"Skipping duplicate SMS {msg_sid} from {from_number}")
        return Response("", status=200, mimetype="text/plain")

    now = datetime.now(timezone.utc).isoformat()

    # Resolve which agent owns this lead (multi-tenant routing)
    ctx = _resolve_user_context(from_number)
    user_id = ctx["user_id"]
    agent_name = ctx["agent_name"]
    agent_brokerage = ctx["agent_brokerage"]
    agent_phone = ctx["agent_phone"]
    agent_email = ctx["agent_email"]

    print(f"[SMS] Inbound from {from_number}: {body[:100]}")

    # Log to CSV
    _write_csv_row(
        INBOUND_LOG,
        ["timestamp_utc", "wa_id", "message_id", "message_ts", "body"],
        {
            "timestamp_utc": now,
            "wa_id": from_number,
            "message_id": msg_sid,
            "message_ts": now,
            "body": body,
        },
    )

    # Log inbound to Supabase
    _log_sms_to_supabase(user_id, from_number, body, "inbound")

    if SUPABASE_AVAILABLE and user_id:
        log_activity(
            user_id,
            "message_reply",
            f"Inbound SMS from {from_number}: {body[:100]}",
            "received",
            {"phone": from_number, "message": body, "direction": "inbound", "channel": "sms"},
        )

    # Re-engagement: re-opt-in if DNC-listed number sends non-STOP
    if SUPABASE_AVAILABLE and user_id and not is_stop_message(body) and is_on_dnc_list(user_id, from_number):
        remove_from_dnc_list(user_id, from_number)
        log_activity(
            user_id,
            "re_opt_in",
            f"User {from_number} re-engaged via SMS after previous opt-out — removed from DNC",
            "success",
            {"phone": from_number, "message": body, "channel": "sms"},
        )

    # Handle STOP messages
    if is_stop_message(body):
        if SUPABASE_AVAILABLE and user_id:
            add_to_dnc_list(user_id, from_number, "STOP keyword via SMS webhook")
            log_activity(
                user_id,
                "opt_out",
                f"User {from_number} opted out via SMS STOP keyword",
                "success",
                {"phone": from_number, "message": body, "channel": "sms"},
            )

        _send_sms_message(
            from_number,
            "You're unsubscribed. You won't receive any further messages. "
            "Thank you for letting us know.",
        )
        return Response("", status=200, mimetype="text/plain")

    # Fetch conversation history and lead details
    conversation_history = []
    lead_details = None
    if SUPABASE_AVAILABLE and user_id:
        conversation_history = get_conversation_history(user_id, from_number)
        lead_details = get_lead_details(user_id, from_number)

    # Generate AI reply
    ai_result = analyze_with_ai(
        body, from_number, TWILIO_PHONE_NUMBER,
        conversation_history=conversation_history,
        lead_details=lead_details,
        agent_name=agent_name,
        agent_brokerage=agent_brokerage,
    )

    # Handle stop intent
    if ai_result.get("intent") == "stop":
        if SUPABASE_AVAILABLE and user_id:
            add_to_dnc_list(user_id, from_number, "AI-detected stop intent via SMS")
            log_activity(
                user_id,
                "opt_out",
                f"User {from_number} opted out via SMS (AI-detected intent)",
                "success",
                {"phone": from_number, "message": body, "channel": "sms"},
            )
        _send_sms_message(
            from_number,
            "You're unsubscribed. You won't receive any further messages. Thank you.",
        )
        return Response("", status=200, mimetype="text/plain")

    # Handle escalation
    if ai_result.get("intent") == "escalate":
        escalation_reply = ai_result.get(
            "reply",
            "I hear you, and I want to make sure this is handled properly. "
            "Let me review the details and get back to you directly.",
        )
        _send_sms_message(from_number, escalation_reply)

        # Notify agent via SMS if agent phone is available
        if agent_phone:
            notify_msg = (
                f"ESCALATION NEEDED (SMS)\n"
                f"Lead: {from_number}\n"
                f"Message: {body[:200]}\n"
                f"AI Notes: {ai_result.get('notes', 'N/A')}\n"
                f"Please follow up directly."
            )
            _send_sms_message(agent_phone, notify_msg)

        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id,
                "escalation",
                f"Lead {from_number} escalated to agent via SMS: {body[:100]}",
                "pending",
                {"phone": from_number, "message": body, "notes": ai_result.get("notes"), "channel": "sms"},
            )

        _log_sms_to_supabase(user_id, from_number, body, "outbound",
                             reply_text=escalation_reply, send_status="sent")
        return Response("", status=200, mimetype="text/plain")

    reply_text = ai_result.get("reply", "Thanks for your message! I'll follow up shortly.")

    # DNC send-side check
    if SUPABASE_AVAILABLE and user_id and is_on_dnc_list(user_id, from_number):
        print(f"Blocked SMS outbound to DNC number {from_number}")
        return Response("", status=200, mimetype="text/plain")

    send_result = _send_sms_message(from_number, reply_text)

    # Auto-create follow-up when AI sets schedule_follow_up_days
    follow_up_days = ai_result.get("schedule_follow_up_days")
    if follow_up_days and isinstance(follow_up_days, (int, float)) and follow_up_days > 0 and SUPABASE_AVAILABLE and user_id:
        try:
            from datetime import timedelta
            lead = find_lead_by_phone(user_id, from_number)
            if lead:
                follow_up_dt = datetime.now(timezone.utc) + timedelta(days=int(follow_up_days))
                lead_name = lead.get("owner_name", "there").split(" ")[0]

                ai_notes = ai_result.get("notes", "")
                qualification = ai_result.get("qualification", {})
                property_addr = qualification.get("property_address") or lead.get("property_address") or ""
                owner_goal = qualification.get("owner_goal") or ""

                if ai_notes and ("interest" in ai_notes.lower() or "looking" in ai_notes.lower() or "buy" in ai_notes.lower() or "invest" in ai_notes.lower()):
                    follow_up_msg = (
                        f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. "
                        f"We spoke a few months back and you mentioned you'd be ready around now. "
                        f"I have some opportunities that might match what you're looking for. "
                        f"Would you have time for a quick call this week?"
                    )
                elif property_addr:
                    follow_up_msg = (
                        f"Hi {lead_name}, it's {agent_name}. "
                        f"We chatted about your property at {property_addr}. "
                        f"The market has had some movement since then — "
                        f"happy to share an updated analysis. "
                        f"Are you still thinking about {owner_goal or 'your options'}?"
                    )
                else:
                    follow_up_msg = (
                        f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. "
                        f"We connected a few months ago and you mentioned checking back around now. "
                        f"Would you have a few minutes this week?"
                    )

                create_follow_up(
                    user_id=user_id,
                    lead_id=lead.get("id"),
                    message_text=follow_up_msg,
                    scheduled_at=follow_up_dt.isoformat(),
                    channel="sms",
                )
                log_activity(
                    user_id, "followup",
                    f"Auto-scheduled SMS follow-up in {follow_up_days} days for {from_number} (notes: {ai_notes[:100]})",
                    "success",
                    {"phone": from_number, "follow_up_days": follow_up_days, "scheduled_at": follow_up_dt.isoformat(), "ai_notes": ai_notes},
                )
        except Exception as e:
            print(f"Error creating SMS scheduled follow-up: {e}")

    # Log outbound
    send_status = "sent" if send_result.get("ok") else "failed"
    _log_sms_to_supabase(user_id, from_number, body, "outbound",
                         reply_text=reply_text, send_status=send_status)

    if SUPABASE_AVAILABLE and user_id:
        intent = ai_result.get("intent", "other")
        log_activity(
            user_id,
            "message_reply",
            f"AI bot replied via SMS to {from_number} (intent: {intent}): {reply_text[:100]}",
            send_status,
            {"phone": from_number, "reply": reply_text, "intent": intent, "direction": "outbound", "channel": "sms"},
        )

    return Response("", status=200, mimetype="text/plain")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
