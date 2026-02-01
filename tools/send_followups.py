import csv
import argparse
from datetime import date

def send_sms(to_number: str, body: str) -> str:
    """
    Send an outbound message in demo mode.
    This is a WhatsApp-only stub with no external provider dependency.
    """
    if not to_number:
        return "skipped: no phone"
    print(f"[demo] WhatsApp send to {to_number}: {body}")
    return "demo: whatsapp stub"


def main():
    parser = argparse.ArgumentParser(
        description="Send due follow-up SMS from followups.csv"
    )
    parser.add_argument("followups_csv", help="followups.csv created by build_followups.py")
    parser.add_argument(
        "--today",
        help="Override 'today' date YYYY-MM-DD (for testing). Default: system date.",
    )
    parser.add_argument(
        "--test-to-phone",
        help="If set, ALL follow-ups go to this number instead of the lead phones (safe test mode).",
    )
    args = parser.parse_args()

    today_str = args.today or date.today().isoformat()

    # Load all rows
    with open(args.followups_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        print("No rows found in followups CSV.")
        return

    changed = False
    for row in rows:
        status = row.get("status", "")
        send_date = row.get("send_date", "")
        phone = (row.get("phone") or "").strip()
        msg = (row.get("message_text") or "").strip()

        # Only send:
        # - status pending
        # - send_date == today
        if status != "pending":
            continue
        if send_date != today_str:
            continue

        if not msg:
            row["status"] = "skipped: empty message"
            changed = True
            continue

        if not phone and not args.test_to_phone:
            row["status"] = "skipped: no phone"
            changed = True
            continue

        actual_to = args.test_to_phone or phone
        print(f"Sending follow-up to {actual_to} for {row.get('property_address','')} (day_offset={row.get('day_offset','')})")

        send_status = send_sms(actual_to, msg)
        row["status"] = f"{send_status} @ {today_str}"
        changed = True

    # Write back updates
    if changed:
        fieldnames = rows[0].keys()
        with open(args.followups_csv, "w", newline="", encoding="utf-8") as f_out:
            writer = csv.DictWriter(f_out, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    print(f"Done processing follow-ups for {today_str}")


if __name__ == "__main__":
    main()
