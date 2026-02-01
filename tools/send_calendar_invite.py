import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import uuid


def build_ics(
    organizer_name: str,
    organizer_email: str,
    lead_name: str,
    lead_email: str,
    subject: str,
    description: str,
    start_dt: datetime,
    duration_minutes: int = 30,
) -> str:
    end_dt = start_dt + timedelta(minutes=duration_minutes)

    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = start_dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtend = end_dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    uid = f"{uuid.uuid4()}@nadine-agent"

    ics = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nadine Listing Agent//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{dtstamp}
DTSTART:{dtstart}
DTEND:{dtend}
SUMMARY:{subject}
DESCRIPTION:{description}
ORGANIZER;CN={organizer_name}:mailto:{organizer_email}
ATTENDEE;CN={lead_name};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{lead_email}
END:VEVENT
END:VCALENDAR
"""
    return ics


def send_invite(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    organizer_name: str,
    organizer_email: str,
    lead_name: str,
    lead_email: str,
    subject: str,
    body_text: str,
    ics_text: str,
):
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = f"{organizer_name} <{organizer_email}>"
    msg["To"] = lead_email

    alt = MIMEMultipart("alternative")
    msg.attach(alt)
    alt.attach(MIMEText(body_text, "plain", "utf-8"))

    ical_part = MIMEText(ics_text, "calendar", "utf-8")
    ical_part.replace_header(
        "Content-Type",
        'text/calendar; method=REQUEST; charset="UTF-8"',
    )
    ical_part.add_header("Content-Disposition", "attachment", filename="invite.ics")
    msg.attach(ical_part)

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)

    print(f"\n✅ Invite sent to {lead_email}")


def main():
    print("=== Send Calendar Invite (Manual Trigger) ===\n")

    organizer_name = os.environ.get("ORGANIZER_NAME", "Nadine Khalil")
    organizer_email = os.environ.get("ORGANIZER_EMAIL")

    if not organizer_email:
        raise ValueError("Set ORGANIZER_EMAIL to Nadine's Gmail in environment variables.")

    smtp_host = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("EMAIL_PORT", "587"))
    smtp_user = os.environ.get("EMAIL_USER")
    smtp_password = os.environ.get("EMAIL_PASSWORD")

    if not smtp_user or not smtp_password:
        raise ValueError("Set EMAIL_USER and EMAIL_PASSWORD for Gmail SMTP (app password).")

    # ---- prompt you for the specific lead / meeting ----
    lead_name = input("Lead name (as you'd like it to appear): ").strip()
    lead_email = input("Lead email: ").strip()

    subject = input("Meeting subject (e.g. 'Quick call about your property'): ").strip()
    if not subject:
        subject = "Call about your property"

    default_description = "Looking forward to speaking with you about your property."
    description = input(f"Description [{default_description}]: ").strip() or default_description

    start_str = input('Start datetime (YYYY-MM-DD HH:MM, your local time): ').strip()
    duration_str = input("Duration in minutes [30]: ").strip()
    duration = int(duration_str) if duration_str else 30

    # parse date/time, treat as local then attach UTC (simple approximation)
    start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
    start_dt = start_dt.replace(tzinfo=timezone.utc)

    ics_text = build_ics(
        organizer_name=organizer_name,
        organizer_email=organizer_email,
        lead_name=lead_name,
        lead_email=lead_email,
        subject=subject,
        description=description,
        start_dt=start_dt,
        duration_minutes=duration,
    )

    body_text = (
        f"Hi {lead_name},\n\n"
        f"I've sent over a calendar invite for our meeting about your property.\n\n"
        f"Best,\n{organizer_name}"
    )

    send_invite(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_password=smtp_password,
        organizer_name=organizer_name,
        organizer_email=organizer_email,
        lead_name=lead_name,
        lead_email=lead_email,
        subject=subject,
        body_text=body_text,
        ics_text=ics_text,
    )


if __name__ == "__main__":
    main()
