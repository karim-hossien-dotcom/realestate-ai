import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/app/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// POST /api/leads/extract-details - Extract lead details from conversation using AI
export async function POST(request: NextRequest) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { conversationText, leadId } = body

  if (!conversationText) {
    return NextResponse.json({ ok: false, error: 'No conversation text provided' }, { status: 400 })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a real estate assistant that extracts lead information from conversations.

Extract the following STRUCTURED fields if mentioned:
- property_interest: What type of property they're interested in (e.g., "3-bedroom house", "commercial office space", "2BR condo")
- budget_min: Minimum budget in dollars (just the number, e.g., 450000)
- budget_max: Maximum budget in dollars (just the number, e.g., 500000)
- property_type: One of: residential, commercial, land, multi-family, industrial
- location_preference: Preferred areas/neighborhoods mentioned

ALSO extract important information that doesn't fit the above fields into a "notes" field. Include things like:
- Scheduled meetings/viewings (dates, times)
- Specific requirements (must have garage, needs pool, etc.)
- Timeline urgency (needs to move by X date)
- Financing status (pre-approved, cash buyer, needs mortgage)
- Family situation (has kids, pets, works from home)
- Any concerns or objections mentioned
- Contact preferences (best time to call, preferred method)

Return a JSON object. Include "notes" as a bullet-point summary of important details not captured in other fields.
Example output: {
  "property_interest": "3-bedroom house with a backyard",
  "budget_min": 400000,
  "budget_max": 500000,
  "property_type": "residential",
  "location_preference": "Oak Street area",
  "notes": "• Viewing scheduled for Saturday 2 PM\\n• First-time buyer\\n• Pre-approved for mortgage\\n• Wants to move in within 2 months"
}`
        },
        {
          role: 'user',
          content: `Extract lead details from this conversation:\n\n${conversationText}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const extractedText = completion.choices[0]?.message?.content || '{}'
    let extracted: Record<string, unknown> = {}

    try {
      extracted = JSON.parse(extractedText)
    } catch {
      return NextResponse.json({ ok: false, error: 'Failed to parse AI response' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      extracted,
      leadId
    })
  } catch (error) {
    console.error('Error extracting lead details:', error)
    return NextResponse.json({ ok: false, error: 'Failed to extract details' }, { status: 500 })
  }
}
