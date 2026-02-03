import os
import csv
import json
from datetime import datetime, timezone
from typing import Iterable

import fcntl
import requests
from flask import Flask, request, Response, jsonify

from tools.ai_inbound_agent import generate_reply, is_stop_message


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

    url = f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
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
    for msg in messages:
        wa_id = msg["wa_id"]
        body = msg["body"]
        msg_id = msg["message_id"]
        ts = msg["timestamp"]

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
            _send_whatsapp_message(
                wa_id,
                "You're unsubscribed. You won't receive any further messages. "
                "Thank you for letting us know.",
            )
            continue

        reply_text = generate_reply(body, wa_id, WHATSAPP_PHONE_NUMBER_ID)
        send_result = _send_whatsapp_message(wa_id, reply_text)

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

    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
