import OpenAI from 'openai'

const openai = new OpenAI()

export type Lead = {
  owner_name?: string
  property_address?: string
  phone?: string
  email?: string
}

export type GeneratedMessages = {
  sms_text: string
  email_subject: string
  email_body: string
  call_opener: string
  voicemail_script: string
}

function buildPrompt(baseScript: string, agentName: string, brokerage: string, lead: Lead): string {
  const ownerName = (lead.owner_name || '').trim() || 'there'
  const address = (lead.property_address || '').trim() || 'your property'

  const personalizedScript = baseScript
    .replace(/\[OWNER_NAME\]/g, ownerName)
    .replace(/\[PROPERTY_ADDRESS\]/g, address)

  return `
You are an inside sales assistant helping a commercial real estate agent book listing appointments.

Agent:
- Name: ${agentName}
- Brokerage: ${brokerage}

Lead:
- Owner name: ${ownerName}
- Property address: ${address}

Base outreach script (already personalized):
"""${personalizedScript}"""

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
`
}

export async function generateMessagesForLead(
  baseScript: string,
  agentName: string,
  brokerage: string,
  lead: Lead,
  model = 'gpt-4.1-mini',
  temperature = 0.4
): Promise<GeneratedMessages> {
  const prompt = buildPrompt(baseScript, agentName, brokerage, lead)

  const response = await openai.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a helpful real estate ISA assistant.' },
      { role: 'user', content: prompt },
    ],
    temperature,
  })

  const content = response.choices[0].message.content || '{}'
  const data = JSON.parse(content) as Partial<GeneratedMessages>

  // Ensure all keys exist
  return {
    sms_text: data.sms_text || '',
    email_subject: data.email_subject || '',
    email_body: data.email_body || '',
    call_opener: data.call_opener || '',
    voicemail_script: data.voicemail_script || '',
  }
}

// Default base script if none provided
export const DEFAULT_BASE_SCRIPT = `Hi [OWNER_NAME],

I'm reaching out about [PROPERTY_ADDRESS]. I work with investors and businesses looking for commercial properties in your area, and wanted to see if you've considered selling or have any interest in discussing your property's current market value.

No pressure at all - just wanted to introduce myself in case you ever think about it. Would you be open to a quick conversation in the next few weeks?`

export async function generateMessagesForLeads(
  leads: Lead[],
  options: {
    baseScript?: string
    agentName?: string
    brokerage?: string
    model?: string
    temperature?: number
  } = {}
): Promise<(Lead & GeneratedMessages)[]> {
  const {
    baseScript = DEFAULT_BASE_SCRIPT,
    agentName = process.env.AGENT_NAME || 'Nadine Khalil',
    brokerage = process.env.BROKERAGE || 'KW Commercial',
    model = 'gpt-4.1-mini',
    temperature = 0.4,
  } = options

  const results: (Lead & GeneratedMessages)[] = []

  for (const lead of leads) {
    const messages = await generateMessagesForLead(
      baseScript,
      agentName,
      brokerage,
      lead,
      model,
      temperature
    )

    results.push({
      ...lead,
      ...messages,
    })
  }

  return results
}
