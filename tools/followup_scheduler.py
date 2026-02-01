import csv
import os
from datetime import datetime, timedelta, timezone

LEADS_STATE_FILE = "leads_state.csv"


def load_leads():
    leads = []
    if not os.path.exists(LEADS_STATE_FILE):
        return leads

    with open(LEADS_STATE_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            leads.append(row)
    return leads


def save_leads(leads):
    if not leads:
        return
    fieldnames = list(leads[0].keys())
    with open(LEADS_STATE_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(leads)


def parse_iso(dt_str):
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None


def format_iso(dt_obj):
    if not dt_obj:
        return ""
    return dt_obj.astimezone(timezone.utc).isoformat()


def pick_followup_text(stage, name, address=None):
    # TODO: replace with your real templates (Day 1,3,7,14,30)
    first_name = name.split()[0] if name else "there"
    if stage == "new":
        return f"Hi {first_name}, just following up to see if you'd consider selling your property in the next 3–6 months."
    elif stage == "outbound_sent":
        return f"Hi {first_name}, wanted to make sure you saw my last message about your property. Open to a quick call?"
    elif stage == "followup1":
        return f"Hi {first_name}, still have buyers interested in your area. Any thoughts on timing for a potential sale?"
    elif stage == "followup2":
        return f"Hi {first_name}, totally understand if now isn’t ideal. Would it make sense to revisit in a few months?"
    elif stage == "followup3":
        return f"Hi {first_name}, I’ll close the loop after this message unless you’d like to explore options for your property."
    else:
        return None  # nothing else to send


def next_stage_and_delay(stage):
    # Return (next_stage, delay_in_days)
    if stage == "new":
        return "outbound_sent", 1
    elif stage == "outbound_sent":
        return "followup1", 2
    elif stage == "followup1":
        return "followup2", 4
    elif stage == "followup2":
        return "followup3", 7
    elif stage == "followup3":
        return "done", None
    else:
        return None, None


def send_sms(to_number, body):
    if not to_number:
        return "skipped: no phone"
    print(f"[demo] WhatsApp send to {to_number}: {body}")
    return "demo: whatsapp stub"


def run_scheduler():
    now = datetime.now(timezone.utc)
    leads = load_leads()
    updated = False

    for lead in leads:
        status = lead.get("status", "active")
        if status != "active":
            continue

        stage = lead.get("stage", "new")
        next_followup_str = lead.get("next_followup_at", "")
        next_followup = parse_iso(next_followup_str)

        # if no follow-up date set and stage is new, schedule the first
        if next_followup is None and stage == "new":
            # treat as ready to send the first follow-up
            next_followup = now

        if not next_followup or next_followup > now:
            continue  # not time yet

        to_number = lead.get("phone")
        name = lead.get("name", "")
        address = lead.get("address", "")

        text = pick_followup_text(stage, name, address)
        if not text:
            continue

        # send SMS
        try:
            send_sms(to_number, text)
        except Exception as e:
            print(f"Error sending to {to_number}: {e}")
            continue

        # advance stage
        new_stage, delay_days = next_stage_and_delay(stage)
        lead["last_outbound_at"] = format_iso(now)
        lead["stage"] = new_stage or stage

        if delay_days is not None:
            next_dt = now + timedelta(days=delay_days)
            lead["next_followup_at"] = format_iso(next_dt)
        else:
            lead["next_followup_at"] = ""

        updated = True

    if updated:
        save_leads(leads)


if __name__ == "__main__":
    run_scheduler()
