import OpenAI from 'openai'

const openai = new OpenAI()

export type FollowUpMessages = {
  day1: string
  day3: string
  day7: string
  day14: string
  day30: string
}

export type FollowUpSchedule = {
  leadId: string
  ownerName: string
  propertyAddress: string
  phone: string
  dayOffset: number
  scheduledAt: Date
  messageText: string
}

function buildPrompt(
  lead: { owner_name?: string; property_address?: string },
  firstSms: string,
  contactEmail?: string
): string {
  const name = (lead.owner_name || '').trim() || 'there'
  const address = (lead.property_address || '').trim() || 'your property'

  const contactLine = contactEmail
    ? `You can say they can reply to the text or email at ${contactEmail}.`
    : ''

  return `
You are an inside sales assistant helping a commercial real estate agent.

The agent already sent this initial SMS to the lead:
"""${firstSms}"""

Lead details:
- Name: ${name}
- Property address: ${address}

TASK:
Create follow-up SMS messages for days 1, 3, 7, 14, and 30 after the first contact.

Guidelines:
- Each message must be under ~320 characters.
- Friendly, professional, not pushy.
- Focus on checking in, offering value, or asking if they are open to a quick conversation.
- ${contactLine}
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
`
}

export async function generateFollowUpsForLead(
  lead: { owner_name?: string; property_address?: string },
  firstSms: string,
  options: {
    contactEmail?: string
    model?: string
    temperature?: number
  } = {}
): Promise<FollowUpMessages> {
  const {
    contactEmail,
    model = 'gpt-4.1-mini',
    temperature = 0.4,
  } = options

  const prompt = buildPrompt(lead, firstSms, contactEmail)

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
  const data = JSON.parse(content) as Partial<FollowUpMessages>

  return {
    day1: data.day1 || '',
    day3: data.day3 || '',
    day7: data.day7 || '',
    day14: data.day14 || '',
    day30: data.day30 || '',
  }
}

export const FOLLOWUP_OFFSETS = [1, 3, 7, 14, 30] as const

export function buildFollowUpSchedule(
  leadId: string,
  lead: { owner_name?: string; property_address?: string; phone?: string },
  followUps: FollowUpMessages,
  startDate: Date = new Date()
): FollowUpSchedule[] {
  const schedule: FollowUpSchedule[] = []

  const dayToKey: Record<number, keyof FollowUpMessages> = {
    1: 'day1',
    3: 'day3',
    7: 'day7',
    14: 'day14',
    30: 'day30',
  }

  for (const offset of FOLLOWUP_OFFSETS) {
    const messageText = followUps[dayToKey[offset]]?.trim()
    if (!messageText) continue

    const scheduledAt = new Date(startDate)
    scheduledAt.setDate(scheduledAt.getDate() + offset)

    schedule.push({
      leadId,
      ownerName: lead.owner_name || '',
      propertyAddress: lead.property_address || '',
      phone: lead.phone || '',
      dayOffset: offset,
      scheduledAt,
      messageText,
    })
  }

  return schedule
}
