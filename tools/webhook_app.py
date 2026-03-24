import logging
import os
import csv
import json
import threading
import time
from datetime import datetime, timezone
from typing import Iterable, Optional

import fcntl
import requests
from flask import Flask, request, Response, jsonify

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from tools.ai_inbound_agent import analyze_with_ai, is_stop_message

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
        get_user_ai_config,
        check_meeting_availability,
        update_lead_last_response,
        get_default_user_id,
        create_meeting,
        get_conversation_history,
        get_campaign_names,
        get_lead_details,
        get_supabase_client,
        create_follow_up,
        check_messaging_quota,
        get_user_plan_slug,
        record_overage,
    )
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False


app = Flask(__name__)

# Register SMS blueprint (extracted to keep this file under 800 lines)
from tools.sms_handler import sms_bp
app.register_blueprint(sms_bp)

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

# ---------- Message Batching (Multi-texter Debounce) ----------
# When someone sends multiple short messages in rapid succession (e.g. "Hi" [enter]
# "I want to sell" [enter] "123 Main St"), we buffer them and process as one.
_MSG_BUFFER: dict[str, list[dict]] = {}   # phone -> [buffered messages]
_MSG_TIMERS: dict[str, threading.Timer] = {}  # phone -> pending timer
_MSG_BUFFER_LOCK = threading.Lock()
_DEBOUNCE_SECONDS = 12  # wait this long after last message before processing (increased from 8 to catch rapid multi-texters)


def _flush_message_buffer(wa_id: str) -> None:
    """Called by timer — combines buffered messages and processes them."""
    with _MSG_BUFFER_LOCK:
        buffered = _MSG_BUFFER.pop(wa_id, [])
        _MSG_TIMERS.pop(wa_id, None)

    if not buffered:
        return

    # Combine all message bodies into one
    combined_body = "\n".join(m["body"] for m in buffered if m["body"])
    # Use the first message's metadata for logging
    first_msg = buffered[0]

    logger.info(f"[Debounce] Flushing {len(buffered)} messages from {wa_id}: {combined_body[:100]}")

    # Process the combined message through the normal pipeline
    _process_whatsapp_message(
        wa_id=wa_id,
        body=combined_body,
        msg_id=first_msg["message_id"],
        ts=first_msg["timestamp"],
        msg_type="text",
        now=first_msg["now"],
    )


def _buffer_or_process(wa_id: str, msg: dict, now_iso: str) -> None:
    """
    Buffer a text message for debouncing. If no more messages arrive within
    _DEBOUNCE_SECONDS, the buffer is flushed and processed.
    """
    entry = {
        "body": msg["body"],
        "message_id": msg["message_id"],
        "timestamp": msg["timestamp"],
        "now": now_iso,
    }

    with _MSG_BUFFER_LOCK:
        # Cancel any existing timer for this sender
        existing_timer = _MSG_TIMERS.get(wa_id)
        if existing_timer:
            existing_timer.cancel()

        # Add to buffer
        if wa_id not in _MSG_BUFFER:
            _MSG_BUFFER[wa_id] = []
        _MSG_BUFFER[wa_id].append(entry)

        # Start new timer
        timer = threading.Timer(_DEBOUNCE_SECONDS, _flush_message_buffer, args=[wa_id])
        timer.daemon = True
        timer.start()
        _MSG_TIMERS[wa_id] = timer


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
        "ai_config": None,
        "plan_slug": None,
    }

    if not SUPABASE_AVAILABLE:
        return fallback

    match = find_user_by_lead_phone(phone)
    if not match or not match.get("user_id"):
        return fallback

    owner_id = match["user_id"]
    profile = get_user_profile(owner_id)
    plan_slug = get_user_plan_slug(owner_id)
    if not profile:
        return {**fallback, "user_id": owner_id, "plan_slug": plan_slug}

    return {
        "user_id": owner_id,
        "agent_name": profile.get("full_name") or default_name,
        "agent_brokerage": profile.get("company") or default_brokerage,
        "agent_phone": profile.get("phone") or default_phone,
        "agent_email": profile.get("email") or default_email,
        "ai_config": get_user_ai_config(owner_id),
        "plan_slug": plan_slug,
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
    # Always update qualification fields when AI extracts new data
    # (leads can discuss multiple properties or change their mind)
    if qualification.get("property_address"):
        updates["property_address"] = qualification["property_address"]
    if qualification.get("property_type"):
        updates["property_type"] = qualification["property_type"]
    if qualification.get("owner_goal"):
        updates["property_interest"] = qualification["owner_goal"]
    if qualification.get("price_expectation"):
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
            logger.error(f"Error updating lead from qualification: {e}")


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
    wa_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    checks["whatsapp"] = (
        {"status": "healthy"}
        if wa_token
        else {"status": "degraded", "error": "WHATSAPP_ACCESS_TOKEN not set"}
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


def _process_whatsapp_message(
    wa_id: str,
    body: str,
    msg_id: str,
    ts: str,
    msg_type: str,
    now: str,
) -> None:
    """
    Process a WhatsApp text message through the AI pipeline.
    Called either directly (single message) or after debounce (combined messages).
    Runs the full pipeline: context → AI analysis → reply → post-processing.
    """
    # Resolve which agent owns this lead (multi-tenant routing)
    ctx = _resolve_user_context(wa_id)
    user_id = ctx["user_id"]
    agent_name = ctx["agent_name"]
    agent_brokerage = ctx["agent_brokerage"]
    agent_phone = ctx["agent_phone"]
    ai_config = ctx.get("ai_config")

    # Detect if the sender IS the agent (admin testing or agent messaging themselves)
    sender_digits = "".join(c for c in wa_id if c.isdigit())
    agent_digits = "".join(c for c in (agent_phone or "") if c.isdigit())
    is_agent_sender = bool(sender_digits and agent_digits and sender_digits == agent_digits)

    if is_agent_sender:
        logger.info(f"[Agent-self] Detected agent {agent_name} texting from {wa_id} — skipping AI reply")
        _log_to_supabase(user_id, wa_id, body, msg_id, "inbound")
        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id, "agent_self_message",
                f"Agent texted from their own number {wa_id} — no AI reply sent",
                "info", {"phone": wa_id, "message": body[:100]},
            )
        return

    # Feature gate: AI auto-reply requires Pro plan or above
    plan_slug = ctx.get("plan_slug")
    if plan_slug == "starter":
        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id, "feature_blocked",
                f"AI auto-reply skipped for {wa_id} — Starter plan. Upgrade to Pro for AI replies.",
                "info", {"phone": wa_id, "feature": "ai_auto_reply", "plan": "starter"},
            )
        ack_text = (
            f"Thanks for reaching out! {agent_name} will get back to you shortly. "
            f"(Automated reply — {agent_name}'s AI assistant)"
        )
        _send_whatsapp_message(wa_id, ack_text)
        _log_to_supabase(user_id, wa_id, body, msg_id, "outbound",
                         reply_text=ack_text, send_status="sent")
        return

    # Fetch conversation history and lead details for context
    conversation_history = []
    lead_details = None
    campaign_context = None
    if SUPABASE_AVAILABLE and user_id:
        conversation_history = get_conversation_history(user_id, wa_id)
        lead_details = get_lead_details(user_id, wa_id)

        # Resolve campaign names for any campaign messages in history
        campaign_ids = list({
            msg["campaign_id"] for msg in conversation_history
            if msg.get("campaign_id")
        })
        if campaign_ids:
            campaign_names = get_campaign_names(user_id, campaign_ids)
            # Tag messages with campaign name
            for msg in conversation_history:
                cid = msg.get("campaign_id")
                if cid and cid in campaign_names:
                    msg["campaign_name"] = campaign_names[cid]
            # Build context string for the most recent campaign
            latest_campaign_msg = next(
                (m for m in reversed(conversation_history)
                 if m.get("campaign_name")),
                None
            )
            if latest_campaign_msg:
                campaign_context = latest_campaign_msg["campaign_name"]

    # Generate AI reply with full analysis + conversation context
    ai_result = analyze_with_ai(
        body, wa_id, WHATSAPP_PHONE_NUMBER_ID,
        conversation_history=conversation_history,
        lead_details=lead_details,
        agent_name=agent_name,
        agent_brokerage=agent_brokerage,
        ai_config=ai_config,
        campaign_context=campaign_context,
    )

    # If AI detects escalation need, notify the agent
    if ai_result.get("intent") == "escalate":
        escalation_reply = ai_result.get(
            "reply",
            "I hear you, and I want to make sure this is handled properly. "
            "Let me review the details and get back to you directly."
        )
        _send_whatsapp_message(wa_id, escalation_reply)

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
                user_id, "escalation",
                f"Lead {wa_id} escalated to agent: {body[:100]}",
                "pending",
                {"phone": wa_id, "message": body, "notes": ai_result.get("notes")},
            )

        _log_to_supabase(user_id, wa_id, body, msg_id, "outbound",
                         reply_text=escalation_reply, send_status="sent")
        return

    # If AI detects stop intent, verify with keyword checker before opt-out.
    # AI alone is unreliable — it once classified "Thanks" as stop intent.
    if ai_result.get("intent") == "stop":
        if is_stop_message(body):
            # Confirmed by keyword checker — actually a stop request
            if SUPABASE_AVAILABLE and user_id:
                add_to_dnc_list(user_id, wa_id, "AI-detected stop intent (confirmed by keyword check)")
                log_activity(
                    user_id, "opt_out",
                    f"User {wa_id} opted out (AI + keyword confirmed)",
                    "success",
                    {"phone": wa_id, "message": body},
                )
            _send_whatsapp_message(
                wa_id,
                "You're unsubscribed. You won't receive any further messages. "
                "Thank you for letting us know.",
            )
            return
        else:
            # AI said stop but keywords don't confirm — override to "other" and continue
            logger.warning(f"[Stop override] AI classified '{body[:50]}' as stop but keyword check disagreed — continuing")
            ai_result["intent"] = "other"

    reply_text = ai_result.get("reply", "Thanks for your message! I'll follow up shortly.")

    # DNC send-side check: never send to numbers on the DNC list
    if SUPABASE_AVAILABLE and user_id and is_on_dnc_list(user_id, wa_id):
        logger.warning(f"Blocked outbound to DNC number {wa_id}")
        log_activity(
            user_id, "dnc_blocked",
            f"Blocked outbound message to DNC number {wa_id}",
            "blocked",
            {"phone": wa_id, "reason": "on_dnc_list"},
        )
        return

    # Check messaging quota — record overage if over limit
    wa_quota = None
    if SUPABASE_AVAILABLE and user_id:
        wa_quota = check_messaging_quota(user_id)
        if wa_quota.get("current", 0) >= wa_quota.get("limit", 0) and wa_quota.get("limit", 0) > 0:
            logger.warning(f"[Overage] User {user_id} over quota ({wa_quota.get('current')}/{wa_quota.get('limit')}), will record overage")

    send_result = _send_whatsapp_message(wa_id, reply_text)

    # Record overage after successful send
    if send_result and SUPABASE_AVAILABLE and user_id and wa_quota:
        if wa_quota.get("current", 0) >= wa_quota.get("limit", 0) and wa_quota.get("limit", 0) > 0:
            from datetime import datetime as dt_util
            period_start = wa_quota.get("period_start") or dt_util.utcnow().replace(day=1).isoformat()
            record_overage(user_id, "whatsapp", period_start)

    # Update lead with qualification data extracted by AI
    qualification = ai_result.get("qualification", {})
    if qualification and SUPABASE_AVAILABLE and user_id:
        _update_lead_from_qualification(user_id, wa_id, qualification, ai_result)

    # Create meeting ONLY when ready_to_book (has both date and time)
    meeting_data = ai_result.get("meeting", {})
    # Validate date_suggestion is in the future — AI sometimes returns today's date by mistake
    if meeting_data.get("date_suggestion"):
        try:
            suggested_dt = datetime.fromisoformat(meeting_data["date_suggestion"].replace("Z", "+00:00"))
            if suggested_dt < datetime.now(timezone.utc):
                logger.warning(f"[Meeting] AI suggested past date {meeting_data['date_suggestion']} — ignoring meeting booking")
                meeting_data["ready_to_book"] = False
        except (ValueError, TypeError):
            logger.warning(f"[Meeting] Invalid date_suggestion: {meeting_data.get('date_suggestion')}")
            meeting_data["ready_to_book"] = False

    if meeting_data.get("ready_to_book") and meeting_data.get("date_suggestion") and SUPABASE_AVAILABLE and user_id:
        _handle_meeting_booking(user_id, wa_id, body, msg_id, agent_name,
                                meeting_data, qualification, ai_result)

    # Auto-create follow-up when AI sets schedule_follow_up_days
    follow_up_days = ai_result.get("schedule_follow_up_days")
    if follow_up_days and isinstance(follow_up_days, (int, float)) and follow_up_days > 0 and SUPABASE_AVAILABLE and user_id:
        _handle_auto_follow_up(user_id, wa_id, agent_name, agent_brokerage,
                               follow_up_days, ai_result)

    # Log agent brief when lead is fully qualified
    agent_brief = ai_result.get("agent_brief")
    if agent_brief and SUPABASE_AVAILABLE and user_id:
        log_activity(
            user_id, "lead_qualified",
            f"Lead {wa_id} fully qualified by AI bot",
            "success",
            {"phone": wa_id, "agent_brief": agent_brief, "qualification": qualification},
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


def _handle_meeting_booking(
    user_id: str, wa_id: str, body: str, msg_id: str,
    agent_name: str, meeting_data: dict, qualification: dict, ai_result: dict,
) -> None:
    """Handle meeting creation when AI determines ready_to_book."""
    date_suggestion = meeting_data.get("date_suggestion", "")
    proposed_date = date_suggestion[:10] if len(date_suggestion) >= 10 else ""
    proposed_time = date_suggestion[11:16] if len(date_suggestion) >= 16 else ""

    availability = {"available": True, "conflicts": []}
    if proposed_date and proposed_time:
        availability = check_meeting_availability(user_id, proposed_date, proposed_time)

    if not availability["available"]:
        conflict_info = availability["conflicts"]
        conflict_desc = ", ".join(
            f"{c.get('title', 'Meeting')} at {c.get('time', '?')}" for c in conflict_info
        )
        conflict_reply = (
            f"I just checked the calendar and there's a conflict — "
            f"you already have: {conflict_desc}. "
            f"Would another time work? What about later that day or the next day?"
        )
        _send_whatsapp_message(wa_id, conflict_reply)
        _log_to_supabase(user_id, wa_id, body, msg_id, "outbound",
                         reply_text=conflict_reply, send_status="sent")
        log_activity(
            user_id, "meeting_conflict",
            f"AI detected scheduling conflict for {wa_id}: {conflict_desc}",
            "warning",
            {"phone": wa_id, "conflicts": conflict_info, "proposed": date_suggestion},
        )
        return

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

    # Auto-create day-before confirmation follow-up (DEDUP: only if no existing reminder for this date)
    if meeting_data.get("date_suggestion") and lead:
        try:
            from datetime import timedelta
            meeting_dt = datetime.fromisoformat(
                meeting_data["date_suggestion"].replace("Z", "+00:00")
            )
            confirm_dt = meeting_dt - timedelta(days=1)

            # Check if we already created a reminder for this meeting date
            existing = get_supabase_client().table("follow_ups").select("id").eq(
                "user_id", user_id
            ).eq("lead_id", lead.get("id")).like(
                "message_text", f"%reminder about our meeting tomorrow%"
            ).gte("scheduled_at", confirm_dt.date().isoformat()).limit(1).execute()

            if existing.data:
                logger.info(f"[Meeting] Reminder already exists for {wa_id} on {confirm_dt.date()} — skipping")
            else:
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
            logger.error(f"Error creating confirmation follow-up: {e}")


def _handle_auto_follow_up(
    user_id: str, wa_id: str, agent_name: str, agent_brokerage: str,
    follow_up_days: int, ai_result: dict,
) -> None:
    """Auto-create follow-up when AI sets schedule_follow_up_days."""
    try:
        from datetime import timedelta
        lead = find_lead_by_phone(user_id, wa_id)
        if not lead:
            return

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
        logger.error(f"Error creating scheduled follow-up: {e}")


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
            logger.debug(f"Skipping duplicate message {msg_id} from {wa_id}")
            continue

        # Resolve which agent owns this lead (for non-text and STOP handling)
        ctx = _resolve_user_context(wa_id)
        user_id = ctx["user_id"]
        agent_name = ctx["agent_name"]

        msg_type = msg.get("type", "text")

        # Handle non-text messages immediately (voice, image, video, etc.)
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

            _log_to_supabase(user_id, wa_id, f"[{msg_type} message]", msg_id, "inbound")
            _log_to_supabase(user_id, wa_id, f"[{msg_type} message]", msg_id, "outbound",
                             reply_text=ack_reply, send_status="sent")

            if SUPABASE_AVAILABLE and user_id:
                log_activity(
                    user_id, "message_reply",
                    f"Acknowledged {msg_type} message from {wa_id}",
                    "sent",
                    {"phone": wa_id, "type": msg_type, "direction": "inbound"},
                )
            continue

        # --- Text message: log immediately, then debounce AI processing ---

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

        # Log to Supabase immediately (each message gets its own record)
        _log_to_supabase(user_id, wa_id, body, msg_id, "inbound")

        # Log inbound to activity_logs
        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id, "message_reply",
                f"Inbound WhatsApp from {wa_id}: {body[:100]}",
                "received",
                {"phone": wa_id, "message": body, "direction": "inbound"},
            )

        # Re-engagement: if a DNC-listed number sends a non-STOP message, re-opt-in
        if SUPABASE_AVAILABLE and user_id and not is_stop_message(body) and is_on_dnc_list(user_id, wa_id):
            remove_from_dnc_list(user_id, wa_id)
            log_activity(
                user_id, "re_opt_in",
                f"User {wa_id} re-engaged after previous opt-out — removed from DNC",
                "success",
                {"phone": wa_id, "message": body},
            )

        # Handle STOP messages immediately (no debounce)
        if is_stop_message(body):
            # Cancel any pending debounce for this number
            with _MSG_BUFFER_LOCK:
                existing_timer = _MSG_TIMERS.pop(wa_id, None)
                if existing_timer:
                    existing_timer.cancel()
                _MSG_BUFFER.pop(wa_id, None)

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

            if SUPABASE_AVAILABLE and user_id:
                add_to_dnc_list(user_id, wa_id, "STOP keyword via webhook")
                log_activity(
                    user_id, "opt_out",
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

        # Buffer this message — AI processing fires after quiet period
        _buffer_or_process(wa_id, msg, now)

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
