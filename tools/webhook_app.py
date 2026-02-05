import os
import csv
import json
from datetime import datetime, timezone
from typing import Iterable, Optional

import fcntl
import requests
from flask import Flask, request, Response, jsonify

from tools.ai_inbound_agent import generate_reply, is_stop_message

# Import Supabase DB functions (optional - falls back to CSV if not configured)
try:
    from tools.db import (
        log_inbound_message,
        log_outbound_message,
        add_to_dnc_list,
        log_activity,
        find_lead_by_phone,
        update_lead_last_response,
        get_default_user_id,
    )
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False


app = Flask(__name__)

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

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
                if message.get("type") != "text":
                    continue
                wa_id = message.get("from", "") or ""
                body = (message.get("text") or {}).get("body") or ""
                msg_id = message.get("id") or ""
                timestamp = message.get("timestamp") or ""
                messages_out.append(
                    {
                        "wa_id": wa_id,
                        "body": body,
                        "message_id": msg_id,
                        "timestamp": timestamp,
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
    """Get the user ID to associate with messages"""
    if SUPABASE_AVAILABLE:
        return get_default_user_id()
    return None


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
    return Response("ok", status=200, mimetype="text/plain")


@app.route("/webhook", methods=["GET"])
def webhook_verify():
    mode = request.args.get("hub.mode", "")
    token = request.args.get("hub.verify_token", "")
    challenge = request.args.get("hub.challenge", "")

    if mode == "subscribe" and token and token == WHATSAPP_VERIFY_TOKEN:
        return Response(challenge, status=200, mimetype="text/plain")

    return Response("Forbidden", status=403, mimetype="text/plain")


@app.route("/webhook", methods=["POST"])
def webhook_inbound():
    payload = request.get_json(silent=True) or {}
    messages = _extract_messages(payload)

    now = datetime.now(timezone.utc).isoformat()
    user_id = _get_user_id()

    for msg in messages:
        wa_id = msg["wa_id"]
        body = msg["body"]
        msg_id = msg["message_id"]
        ts = msg["timestamp"]

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

        # Generate AI reply
        reply_text = generate_reply(body, wa_id, WHATSAPP_PHONE_NUMBER_ID)
        send_result = _send_whatsapp_message(wa_id, reply_text)

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

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
