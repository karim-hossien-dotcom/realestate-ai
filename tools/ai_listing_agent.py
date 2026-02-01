import csv
import json
import argparse
from openai import OpenAI

# Uses your OPENAI_API_KEY environment variable
client = OpenAI()


def build_prompt(base_script: str, agent_name: str, brokerage: str, lead: dict) -> str:
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
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "You are a helpful real estate ISA assistant."},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
    )

    content = response.choices[0].message.content
    data = json.loads(content)

    # Make sure all expected keys exist
    for key in [
        "sms_text",
        "email_subject",
        "email_body",
        "call_opener",
        "voicemail_script",
    ]:
        data.setdefault(key, "")

    return data


def process_csv(
    input_csv: str,
    output_csv: str,
    base_script_path: str,
    agent_name: str,
    brokerage: str,
    model: str = "gpt-4.1-mini",
    temperature: float = 0.4,
) -> None:
    # Read base script
    with open(base_script_path, "r", encoding="utf-8") as f:
        base_script = f.read()

    # Read leads
    with open(input_csv, newline="", encoding="utf-8") as f_in:
        reader = csv.DictReader(f_in)
        leads = list(reader)

        # Clean fieldnames (remove None or empty headers)
        original_fieldnames = reader.fieldnames or []
        fieldnames = [fn for fn in original_fieldnames if fn]

    if not leads:
        print("No rows found in input CSV.")
        return

    # Add AI output columns
    extra_fields = [
        "sms_text",
        "email_subject",
        "email_body",
        "call_opener",
        "voicemail_script",
    ]
    for col in extra_fields:
        if col not in fieldnames:
            fieldnames.append(col)

    # Write output
    with open(output_csv, "w", newline="", encoding="utf-8") as f_out:
        writer = csv.DictWriter(f_out, fieldnames=fieldnames)
        writer.writeheader()

        for i, lead in enumerate(leads, start=1):
            print(f"Processing lead {i}/{len(leads)}: {lead.get('property_address', '')}")

            ai_data = generate_messages_for_lead(
                base_script=base_script,
                agent_name=agent_name,
                brokerage=brokerage,
                lead=lead,
                model=model,
                temperature=temperature,
            )

            # Merge original lead data + AI data
            row = dict(lead)
            row.update(ai_data)

            # Drop any weird keys (e.g., None) and only keep valid columns
            row = {k: v for k, v in row.items() if k and k in fieldnames}

            writer.writerow(row)

    print(f"Done! Wrote results to {output_csv}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate outreach messages for listing appointments using OpenAI."
    )
    parser.add_argument("input_csv", help="Input CSV with leads (e.g., leads_template.csv)")
    parser.add_argument("output_csv", help="Output CSV with AI-generated messages")
    parser.add_argument("base_script", help="Text file containing the base outreach script")
    parser.add_argument("agent_name", help="Your name (e.g., 'Nadine Khalil')")
    parser.add_argument("brokerage", help="Your brokerage (e.g., 'KW Commercial')")
    parser.add_argument("--model", default="gpt-4.1-mini", help="OpenAI model name")
    parser.add_argument("--temperature", type=float, default=0.4, help="Creativity level (0–1)")

    args = parser.parse_args()

    process_csv(
        input_csv=args.input_csv,
        output_csv=args.output_csv,
        base_script_path=args.base_script,
        agent_name=args.agent_name,
        brokerage=args.brokerage,
        model=args.model,
        temperature=args.temperature,
    )


if __name__ == "__main__":
    main()
