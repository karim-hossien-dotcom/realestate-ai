import csv
import json
import argparse
import os
from datetime import datetime, timezone
from typing import Optional, Dict

from openai import OpenAI
import smtplib
from email.mime.text import MIMEText

# ---------- OpenAI client ----------
# Uses your OPENAI_API_KEY environment variable
client = OpenAI()


# ---------- Utility: load templates ----------

def load_templates(base_script_path: str,
                   template_dir: Optional[str]) -> Dict[str, str]:
    """
    Load a default base script plus optional multiple templates from a directory.

    - base_script_path: path to default template (always loaded)
    - template_dir: optional folder with *.txt templates (filename without extension
      is the template key, e.g. 'investor' from 'investor.txt')

    Returns dict mapping template_name_lower -> script_text
    and special key "__default__" for the base_script_path.
    """
    templates: Dict[str, str] = {}

    # Default template
    with open(base_script_path, "r", encoding="utf-8") as f:
        templates["__default__"] = f.read()

    # Optional multi-template support
    if template_dir and os.path.isdir(template_dir):
        for fname in os.listdir(template_dir):
            if not fname.lower().endswith(".txt"):
                continue
            key = os.path.splitext(fname)[0].strip().lower()
            if not key:
                continue
            path = os.path.join(template_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                templates[key] = f.read()

    return templates


def choose_template_for_lead(templates: Dict[str, str],
                             lead: dict,
                             template_column: str) -> (str, str):
    """
    Decide which template text to use for this lead.

    - templates: dict from load_templates()
    - lead: row dict from CSV
    - template_column: column name in CSV that may contain template name

    Returns (template_name_used, template_text)
    """
    default_script = templates["__default__"]
    value = (lead.get(template_column) or "").strip().lower()
    if value and value in templates:
        return value, templates[value]
    # fall back to default
    return "__default__", default_script


# ---------- WhatsApp (demo stub) ----------

def send_sms(to_number: str,
             body: str,
             override_to: Optional[str] = None) -> str:
    """
    Send an outbound message in demo mode.

    - to_number: lead's phone number (for logging)
    - override_to: if set, ALL messages go to this number (safe test mode)
    """
    if not to_number and not override_to:
        return "skipped: no phone"

    actual_to = override_to or to_number
    print(f"[demo] WhatsApp send to {actual_to}: {body}")
    return f"demo: whatsapp stub (to {actual_to})"


# ---------- Email (SMTP) ----------

def send_email(to_email: str, subject: str, body: str) -> str:
    """
    Send an email using basic SMTP.

    Environment variables:
      EMAIL_HOST        (default smtp.gmail.com)
      EMAIL_PORT        (default 587)
      EMAIL_USER        (your email address / username)
      EMAIL_PASSWORD    (password or app password)
      EMAIL_FROM_NAME   (optional, display name)

    Returns status string.
    """
    if not to_email:
        return "skipped: no email"

    host = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
    port = int(os.environ.get("EMAIL_PORT", "587"))
    user = os.environ.get("EMAIL_USER")
    password = os.environ.get("EMAIL_PASSWORD")
    from_name = os.environ.get("EMAIL_FROM_NAME", user or "")

    if not user or not password:
        return "error: missing EMAIL_USER or EMAIL_PASSWORD"

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{user}>"
    msg["To"] = to_email

    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        return "sent"
    except Exception as e:
        return f"error: {e}"


# ---------- OpenAI prompt + generation ----------

def build_prompt(base_script: str,
                 agent_name: str,
                 brokerage: str,
                 lead: dict) -> str:
    owner_name = (lead.get("owner_name") or "").strip() or "there"
    address = (lead.get("property_address") or "").strip() or "your property"

    personalized_script = (
        base_script.replace("[OWNER_NAME]", owner_name)
                   .replace("[PROPERTY_ADDRESS]", address)
    )

    prompt = f"""
You are an inside sales assistant helping a commercial real estate agent book listing appointments.

Agent:
- Name: {agent_name}
- Brokerage: {brokerage}

Lead:
- Owner name: {owner_name}
- Property address: {address}

Base outreach script (already personalized):
\"\"\"{personalized_script}\"\"\"

TASK:
Using the base script and details above, create outreach in 5 formats:

1. sms_text
   - One SMS message
   - Max ~320 characters
   - Friendly, concise, same core message

2. email_subject
   - Short, professional subject line

3. email_body
   - 1–3 short paragraphs
   - Conversational and professional
   - Clear call to action to speak about selling in the next 3–6 months

4. call_opener
   - 2–3 sentences the agent can say at the start of a phone call

5. voicemail_script
   - 20–30 seconds worth of speech
   - Mention agent name, brokerage, and a call-back number placeholder: [CALLBACK_NUMBER]

RULES:
- Do NOT give legal or financial advice.
- Do NOT promise specific sale prices or timelines.
- Always stay honest and compliant.
- Keep the tone confident but not pushy.

IMPORTANT:
Return your answer as a single JSON object with EXACTLY these keys:
- sms_text
- email_subject
- email_body
- call_opener
- voicemail_script
"""
    return prompt


def generate_messages_for_lead(
    base_script: str,
    agent_name: str,
    brokerage: str,
    lead: dict,
    model: str = "gpt-4.1-mini",
    temperature: float = 0.4,
) -> dict:
    prompt = build_prompt(base_script, agent_name, brokerage, lead)

    response = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},  # cleaner JSON handling
        messages=[
            {"role": "system", "content": "You are a helpful real estate ISA assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )

    content = response.choices[0].message.content

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # fallback: wrap content as plain text if JSON fails
        data = {"sms_text": content}

    # Ensure all expected keys exist
    for key in [
        "sms_text",
        "email_subject",
        "email_body",
        "call_opener",
        "voicemail_script",
    ]:
        data.setdefault(key, "")

    return data


# ---------- Main CSV processing + logging ----------

def process_csv(
    input_csv: str,
    output_csv: str,
    base_script_path: str,
    agent_name: str,
    brokerage: str,
    send_sms_flag: bool,
    send_email_flag: bool,
    log_csv: str,
    test_to_phone: Optional[str],
    template_dir: Optional[str],
    template_column: str,
    model: str = "gpt-4.1-mini",
    temperature: float = 0.4,
) -> None:
    # Load templates (default + optional multi-templates)
    templates = load_templates(base_script_path, template_dir)

    # Read leads
    with open(input_csv, newline="", encoding="utf-8") as f_in:
        reader = csv.DictReader(f_in)
        leads = list(reader)
        original_fieldnames = reader.fieldnames or []
        fieldnames = [fn for fn in original_fieldnames if fn]

    if not leads:
        print("No rows found in input CSV.")
        return

    # Add AI output columns + template used
    extra_fields = [
        "sms_text",
        "email_subject",
        "email_body",
        "call_opener",
        "voicemail_script",
        "used_template",
    ]
    for col in extra_fields:
        if col not in fieldnames:
            fieldnames.append(col)

    # Prepare activity log
    log_fieldnames = [
        "timestamp_utc",
        "property_address",
        "owner_name",
        "lead_phone",
        "actual_sms_to",
        "email",
        "used_template",
        "sms_status",
        "email_status",
    ]
    log_file_exists = os.path.exists(log_csv)

    with open(output_csv, "w", newline="", encoding="utf-8") as f_out, \
         open(log_csv, "a", newline="", encoding="utf-8") as f_log:

        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        log_writer = csv.DictWriter(f_log, fieldnames=log_fieldnames)
        if not log_file_exists:
            log_writer.writeheader()

        for i, lead in enumerate(leads, start=1):
            print(f"Processing lead {i}/{len(leads)}: {lead.get('property_address', '')}")

            template_name, template_text = choose_template_for_lead(
                templates, lead, template_column
            )

            ai_data = generate_messages_for_lead(
                base_script=template_text,
                agent_name=agent_name,
                brokerage=brokerage,
                lead=lead,
                model=model,
                temperature=temperature,
            )

            # Write full AI content back out
            row = dict(lead)
            row.update(ai_data)
            row["used_template"] = template_name
            row = {k: v for k, v in row.items() if k and k in fieldnames}
            writer.writerow(row)

            # --- sending + automatic logging ---
            phone = (lead.get("phone") or "").strip()
            email = (lead.get("email") or "").strip()

            sms_status = "not_sent"
            email_status = "not_sent"
            actual_sms_to = test_to_phone or phone

            if send_sms_flag:
                sms_status = send_sms(
                    to_number=phone,
                    body=ai_data["sms_text"],
                    override_to=test_to_phone,
                )

            if send_email_flag:
                email_status = send_email(
                    to_email=email,
                    subject=ai_data["email_subject"],
                    body=ai_data["email_body"],
                )

            log_writer.writerow(
                {
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    "property_address": lead.get("property_address", ""),
                    "owner_name": lead.get("owner_name", ""),
                    "lead_phone": phone,
                    "actual_sms_to": actual_sms_to,
                    "email": email,
                    "used_template": template_name,
                    "sms_status": sms_status,
                    "email_status": email_status,
                }
            )

    print(f"Done! Wrote messages to {output_csv} and log to {log_csv}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate and optionally send outreach messages for listing appointments."
    )
    parser.add_argument("input_csv", help="Input CSV with leads")
    parser.add_argument("output_csv", help="Output CSV with AI-generated messages")
    parser.add_argument("base_script", help="Default base script (text file)")
    parser.add_argument("agent_name", help="Your name (e.g., 'Nadine Khalil')")
    parser.add_argument("brokerage", help="Your brokerage (e.g., 'KW Commercial')")
    parser.add_argument("--model", default="gpt-4.1-mini", help="OpenAI model name")
    parser.add_argument("--temperature", type=float, default=0.4,
                        help="Creativity level (0–1)")
    parser.add_argument("--send-sms", action="store_true",
                        help="Send outbound messages via WhatsApp stub (demo)")
    parser.add_argument("--send-email", action="store_true",
                        help="Actually send emails via SMTP")
    parser.add_argument(
        "--log-csv",
        default="activity_log.csv",
        help="CSV file to log sending activity (default: activity_log.csv)",
    )
    parser.add_argument(
        "--test-to-phone",
        help="If set, ALL SMS are sent to this number instead of lead phones "
             "(safe test mode).",
    )
    parser.add_argument(
        "--template-dir",
        help="Optional directory of extra templates (*.txt). "
             "Filename (without .txt) must match the template column value.",
    )
    parser.add_argument(
        "--template-column",
        default="template_name",
        help="CSV column indicating which template to use (default: template_name).",
    )

    args = parser.parse_args()

    process_csv(
        input_csv=args.input_csv,
        output_csv=args.output_csv,
        base_script_path=args.base_script,
        agent_name=args.agent_name,
        brokerage=args.brokerage,
        send_sms_flag=args.send_sms,
        send_email_flag=args.send_email,
        log_csv=args.log_csv,
        test_to_phone=args.test_to_phone,
        template_dir=args.template_dir,
        template_column=args.template_column,
        model=args.model,
        temperature=args.temperature,
    )


if __name__ == "__main__":
    main()
