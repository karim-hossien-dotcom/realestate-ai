"""
sms_handler.py

Flask Blueprint for handling inbound SMS via Twilio webhook.
Extracted from webhook_app.py to keep files under 800 lines.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import requests
from flask import Blueprint, request, Response

from tools.ai_inbound_agent import analyze_with_ai, is_stop_message

logger = logging.getLogger(__name__)

# Import shared DB functions
try:
    from tools.db import (
        log_inbound_message,
        log_outbound_message,
        add_to_dnc_list,
        is_on_dnc_list,
        remove_from_dnc_list,
        log_activity,
        find_lead_by_phone,
        get_conversation_history,
        get_lead_details,
        check_messaging_quota,
        record_overage,
        create_follow_up,
    )
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

# Config
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

sms_bp = Blueprint("sms", __name__)


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
            from tools.db import update_lead_last_response
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


@sms_bp.route("/sms", methods=["POST"], strict_slashes=False)
def sms_inbound():
    """Handle inbound SMS from Twilio webhook."""
    # Import shared utilities from webhook_app (avoids circular at module level)
    from tools.webhook_app import _is_rate_limited, _is_duplicate_message, _resolve_user_context, _write_csv_row, INBOUND_LOG

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
        logger.debug(f"Skipping duplicate SMS {msg_sid} from {from_number}")
        return Response("", status=200, mimetype="text/plain")

    now = datetime.now(timezone.utc).isoformat()

    # Resolve which agent owns this lead
    ctx = _resolve_user_context(from_number)
    user_id = ctx["user_id"]
    agent_name = ctx["agent_name"]
    agent_brokerage = ctx["agent_brokerage"]
    agent_phone = ctx["agent_phone"]
    ai_config = ctx.get("ai_config")

    logger.info(f"[SMS] Inbound from {from_number}: {body[:100]}")

    # Log to CSV
    _write_csv_row(
        INBOUND_LOG,
        ["timestamp_utc", "wa_id", "message_id", "message_ts", "body"],
        {"timestamp_utc": now, "wa_id": from_number, "message_id": msg_sid, "message_ts": now, "body": body},
    )

    # Log inbound to Supabase
    _log_sms_to_supabase(user_id, from_number, body, "inbound")

    if SUPABASE_AVAILABLE and user_id:
        log_activity(
            user_id, "message_reply",
            f"Inbound SMS from {from_number}: {body[:100]}",
            "received",
            {"phone": from_number, "message": body, "direction": "inbound", "channel": "sms"},
        )

    # Re-engagement: re-opt-in if DNC-listed number sends non-STOP
    if SUPABASE_AVAILABLE and user_id and not is_stop_message(body) and is_on_dnc_list(user_id, from_number):
        remove_from_dnc_list(user_id, from_number)
        log_activity(
            user_id, "re_opt_in",
            f"User {from_number} re-engaged via SMS after previous opt-out — removed from DNC",
            "success",
            {"phone": from_number, "message": body, "channel": "sms"},
        )

    # Handle STOP messages
    if is_stop_message(body):
        if SUPABASE_AVAILABLE and user_id:
            add_to_dnc_list(user_id, from_number, "STOP keyword via SMS webhook")
            log_activity(
                user_id, "opt_out",
                f"User {from_number} opted out via SMS STOP keyword",
                "success",
                {"phone": from_number, "message": body, "channel": "sms"},
            )
        _send_sms_message(
            from_number,
            "You're unsubscribed. You won't receive any further messages. Thank you for letting us know.",
        )
        return Response("", status=200, mimetype="text/plain")

    # Feature gate: AI auto-reply requires Pro plan or above
    plan_slug = ctx.get("plan_slug")
    if plan_slug == "starter":
        if SUPABASE_AVAILABLE and user_id:
            log_activity(
                user_id, "feature_blocked",
                f"AI auto-reply skipped for SMS {from_number} — Starter plan.",
                "info", {"phone": from_number, "feature": "ai_auto_reply", "plan": "starter", "channel": "sms"},
            )
        ack_text = f"Thanks for reaching out! {agent_name} will get back to you shortly. (Automated reply — {agent_name}'s AI assistant)"
        _send_sms_message(from_number, ack_text)
        _log_sms_to_supabase(user_id, from_number, body, "outbound", reply_text=ack_text, send_status="sent")
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
        ai_config=ai_config,
    )

    # Handle stop intent — verify with keyword checker (same fix as WhatsApp)
    if ai_result.get("intent") == "stop":
        if is_stop_message(body):
            if SUPABASE_AVAILABLE and user_id:
                add_to_dnc_list(user_id, from_number, "AI-detected stop intent via SMS (confirmed)")
                log_activity(user_id, "opt_out", f"User {from_number} opted out via SMS (AI + keyword confirmed)", "success", {"phone": from_number, "message": body, "channel": "sms"})
            _send_sms_message(from_number, "You're unsubscribed. You won't receive any further messages. Thank you.")
            return Response("", status=200, mimetype="text/plain")
        else:
            logger.warning(f"[Stop override] AI classified SMS '{body[:50]}' as stop but keyword check disagreed — continuing")
            ai_result["intent"] = "other"

    # Handle escalation
    if ai_result.get("intent") == "escalate":
        escalation_reply = ai_result.get("reply", "I hear you, and I want to make sure this is handled properly. Let me review the details and get back to you directly.")
        _send_sms_message(from_number, escalation_reply)
        if agent_phone:
            _send_sms_message(agent_phone, f"ESCALATION NEEDED (SMS)\nLead: {from_number}\nMessage: {body[:200]}\nAI Notes: {ai_result.get('notes', 'N/A')}\nPlease follow up directly.")
        if SUPABASE_AVAILABLE and user_id:
            log_activity(user_id, "escalation", f"Lead {from_number} escalated to agent via SMS: {body[:100]}", "pending", {"phone": from_number, "message": body, "notes": ai_result.get("notes"), "channel": "sms"})
        _log_sms_to_supabase(user_id, from_number, body, "outbound", reply_text=escalation_reply, send_status="sent")
        return Response("", status=200, mimetype="text/plain")

    reply_text = ai_result.get("reply", "Thanks for your message! I'll follow up shortly.")

    # DNC send-side check
    if SUPABASE_AVAILABLE and user_id and is_on_dnc_list(user_id, from_number):
        logger.warning(f"Blocked SMS outbound to DNC number {from_number}")
        return Response("", status=200, mimetype="text/plain")

    # Check messaging quota
    sms_quota = None
    if SUPABASE_AVAILABLE and user_id:
        sms_quota = check_messaging_quota(user_id)

    send_result = _send_sms_message(from_number, reply_text)

    # Record overage after successful send
    if send_result and SUPABASE_AVAILABLE and user_id and sms_quota:
        if sms_quota.get("current", 0) >= sms_quota.get("limit", 0) and sms_quota.get("limit", 0) > 0:
            from datetime import datetime as dt_util
            period_start = sms_quota.get("period_start") or dt_util.utcnow().replace(day=1).isoformat()
            record_overage(user_id, "sms", period_start)

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

                if ai_notes and any(kw in ai_notes.lower() for kw in ("interest", "looking", "buy", "invest")):
                    follow_up_msg = f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. We spoke a few months back and you mentioned you'd be ready around now. I have some opportunities that might match what you're looking for. Would you have time for a quick call this week?"
                elif property_addr:
                    follow_up_msg = f"Hi {lead_name}, it's {agent_name}. We chatted about your property at {property_addr}. The market has had some movement since then — happy to share an updated analysis. Are you still thinking about {owner_goal or 'your options'}?"
                else:
                    follow_up_msg = f"Hi {lead_name}, it's {agent_name} from {agent_brokerage}. We connected a few months ago and you mentioned checking back around now. Would you have a few minutes this week?"

                create_follow_up(user_id=user_id, lead_id=lead.get("id"), message_text=follow_up_msg, scheduled_at=follow_up_dt.isoformat(), channel="sms")
                log_activity(user_id, "followup", f"Auto-scheduled SMS follow-up in {follow_up_days} days for {from_number}", "success", {"phone": from_number, "follow_up_days": follow_up_days, "scheduled_at": follow_up_dt.isoformat()})
        except Exception as e:
            logger.error(f"Error creating SMS scheduled follow-up: {e}")

    # Log outbound
    send_status = "sent" if send_result.get("ok") else "failed"
    _log_sms_to_supabase(user_id, from_number, body, "outbound", reply_text=reply_text, send_status=send_status)

    if SUPABASE_AVAILABLE and user_id:
        intent = ai_result.get("intent", "other")
        log_activity(user_id, "message_reply", f"AI bot replied via SMS to {from_number} (intent: {intent}): {reply_text[:100]}", send_status, {"phone": from_number, "reply": reply_text, "intent": intent, "direction": "outbound", "channel": "sms"})

    return Response("", status=200, mimetype="text/plain")
