import csv
import json
from datetime import date, timedelta
import argparse
import os
from openai import OpenAI

client = OpenAI()  # uses OPENAI_API_KEY

FOLLOWUP_OFFSETS = [1, 3, 7, 14, 30]


def build_prompt(lead, first_sms, email_for_contact=None):
    name = (lead.get("owner_name") or "").strip() or "there"
    address = (lead.get("property_address") or "").strip() or "your property"

    contact_line = ""
    if email_for_contact:
        contact_line = f"You can say they can reply to the text or email at {email_for_contact}."

    prompt = f"""
You are an inside sales assistant helping a commercial real estate agent.

The agent already sent this initial SMS to the lead:
\"\"\"{first_sms}\"\"\"

Lead details:
- Name: {name}
- Property address: {address}

TASK:
Create follow-up SMS messages for days 1, 3, 7, 14, and 30 after the first contact.

Guidelines:
- Each message must be under ~320 characters.
- Friendly, professional, not pushy.
- Focus on checking in, offering value, or asking if they are open to a quick conversation.
- {contact_line}
- Do not promise prices or timelines.
- Do not give legal or financial advice.
- Do NOT include links or calendar invites.

Return a JSON object with EXACTLY these keys:
- day1
- day3
- day7
- day14
- day30
Each value is the SMS text for that day.
"""
    return prompt


def generate_followups_for_lead(lead, first_sms, email_for_contact=None, model="gpt-4.1-mini"):
    prompt = build_prompt(lead, first_sms, email_for_contact=email_for_contact)
    resp = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful real estate ISA assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
    )
    content = resp.choices[0].message.content
    data = json.loads(content)

    for k in ["day1", "day3", "day7", "day14", "day30"]:
        data.setdefault(k, "")

    return data


def main():
    parser = argparse.ArgumentParser(
        description="Build follow-up schedule CSV from leads + first SMS."
    )
    parser.add_argument(
        "leads_csv",
        help="Input leads CSV (typically output_full.csv from ai_listing_agent_full.py)",
    )
    parser.add_argument(
        "output_csv",
        help="Output followups CSV (e.g., followups.csv)",
    )
    parser.add_argument(
        "--model",
        default="gpt-4.1-mini",
        help="OpenAI model name",
    )
    parser.add_argument(
        "--first-sms-column",
        default="sms_text",
        help="Column holding the initial SMS (default: sms_text).",
    )
    parser.add_argument(
        "--contact-email",
        help="Optional email to reference in follow-ups (e.g., Nadine's Gmail).",
    )
    args = parser.parse_args()

    today = date.today()

    with open(args.leads_csv, newline="", encoding="utf-8") as f_in, \
         open(args.output_csv, "w", newline="", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in)
        fieldnames = [
            "owner_name",
            "property_address",
            "phone",
            "day_offset",
            "send_date",
            "message_text",
            "status",
        ]
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        leads = list(reader)
        for i, lead in enumerate(leads, start=1):
            print(f"Generating follow-ups for lead {i}/{len(leads)}: {lead.get('property_address','')}")
            first_sms = lead.get(args.first_sms_column, "")
            if not first_sms.strip():
                print("  Skipping: no initial sms_text")
                continue

            followups = generate_followups_for_lead(
                lead,
                first_sms,
                email_for_contact=args.contact_email,
                model=args.model,
            )

            mapping = {
                1: "day1",
                3: "day3",
                7: "day7",
                14: "day14",
                30: "day30",
            }

            for offset in FOLLOWUP_OFFSETS:
                msg = followups.get(mapping[offset], "").strip()
                if not msg:
                    continue
                send_date = today + timedelta(days=offset)
                writer.writerow(
                    {
                        "owner_name": lead.get("owner_name", ""),
                        "property_address": lead.get("property_address", ""),
                        "phone": lead.get("phone", ""),
                        "day_offset": offset,
                        "send_date": send_date.isoformat(),
                        "message_text": msg,
                        "status": "pending",
                    }
                )

    print(f"Done. Follow-up schedule written to {args.output_csv}")


if __name__ == "__main__":
    main()
