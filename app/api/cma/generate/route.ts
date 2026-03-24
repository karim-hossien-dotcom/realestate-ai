import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { parseBody } from '@/app/lib/api'
import { z } from 'zod'
import OpenAI from 'openai'

const cmaSchema = z.object({
  property_address: z.string().min(3),
  property_type: z.enum(['residential', 'commercial', 'industrial', 'land', 'multi-family']),
  sqft: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  units: z.number().optional(),
  year_built: z.number().optional(),
  lot_size: z.string().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'needs-work']).optional(),
  owner_name: z.string().optional(),
  owner_price_expectation: z.string().optional(),
  additional_notes: z.string().optional(),
})

const CMA_PROMPT = `You are an expert real estate appraiser creating a Comparative Market Analysis (CMA) report.

Given the property details below, generate a professional CMA report. Use your knowledge of US real estate markets to provide realistic comparable sales and market data.

IMPORTANT:
- Use REALISTIC price ranges based on the property's location, type, and condition
- Include 3 comparable sales (recent, nearby, similar size/type)
- Provide a recommended listing price range
- Be specific with numbers — don't hedge with "it depends"
- Format for email delivery — clean, professional, readable

Return ONLY valid JSON with this structure:
{
  "market_overview": "2-3 sentences about the local market conditions",
  "comparables": [
    {
      "address": "nearby address",
      "sold_price": "$X",
      "sold_date": "Month YYYY",
      "sqft": 0,
      "price_per_sqft": "$X",
      "notes": "brief comparison note"
    }
  ],
  "price_analysis": {
    "low_estimate": "$X",
    "mid_estimate": "$X",
    "high_estimate": "$X",
    "price_per_sqft_range": "$X-Y",
    "recommended_list_price": "$X",
    "reasoning": "2-3 sentences explaining the recommendation"
  },
  "market_trends": [
    "trend 1",
    "trend 2",
    "trend 3"
  ],
  "recommendations": [
    "recommendation 1 for maximizing value",
    "recommendation 2"
  ],
  "disclaimer": "Standard CMA disclaimer text"
}`

/**
 * POST /api/cma/generate
 * Generate a CMA report for a property using AI.
 */
export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, cmaSchema)
  if (!parsed.ok) return parsed.response

  const data = parsed.data

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const propertyDetails = [
      `Address: ${data.property_address}`,
      `Type: ${data.property_type}`,
      data.sqft ? `Size: ${data.sqft} sqft` : null,
      data.bedrooms ? `Bedrooms: ${data.bedrooms}` : null,
      data.bathrooms ? `Bathrooms: ${data.bathrooms}` : null,
      data.units ? `Units: ${data.units}` : null,
      data.year_built ? `Year Built: ${data.year_built}` : null,
      data.lot_size ? `Lot Size: ${data.lot_size}` : null,
      data.condition ? `Condition: ${data.condition}` : null,
      data.owner_price_expectation ? `Owner's price expectation: ${data.owner_price_expectation}` : null,
      data.additional_notes ? `Notes: ${data.additional_notes}` : null,
    ].filter(Boolean).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CMA_PROMPT },
        { role: 'user', content: `Generate a CMA for this property:\n\n${propertyDetails}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ ok: false, error: 'AI returned empty response' }, { status: 500 })
    }

    const cma = JSON.parse(content)

    await logActivity(
      auth.user.id,
      'cma_generated',
      `CMA generated for ${data.property_address}`,
      'success',
      { property_address: data.property_address, property_type: data.property_type },
    )

    return NextResponse.json({
      ok: true,
      cma,
      property: {
        address: data.property_address,
        type: data.property_type,
        sqft: data.sqft,
        owner_name: data.owner_name,
      },
    })
  } catch (error) {
    console.error('CMA generation error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to generate CMA' },
      { status: 500 }
    )
  }
}
