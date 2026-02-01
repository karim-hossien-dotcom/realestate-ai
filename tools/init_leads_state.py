import csv

RAW_FILE = "leads_template.csv"      # your existing leads file
STATE_FILE = "leads_state.csv"       # new file we want to create

DEFAULT_SOURCE = "FSBO List 1"
DEFAULT_AGENT_ID = "nadine"

def main():
    leads = []
    with open(RAW_FILE, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            phone = row.get("phone", "").strip() or row.get("Phone", "").strip()
            name = row.get("name", "").strip() or row.get("Name", "").strip()
            address = row.get("address", "").strip() or row.get("Address", "").strip()

            leads.append({
                "phone": phone,
                "name": name,
                "address": address,
                "source": DEFAULT_SOURCE,
                "agent_id": DEFAULT_AGENT_ID,
                "stage": "new",
                "status": "active",
                "last_outbound_at": "",
                "next_followup_at": "",
                "notes": "",
            })

    fieldnames = [
        "phone","name","address","source","agent_id",
        "stage","status","last_outbound_at","next_followup_at","notes"
    ]
    with open(STATE_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(leads)

    print(f"✅ Created {STATE_FILE} with {len(leads)} rows.")

if __name__ == "__main__":
    main()
