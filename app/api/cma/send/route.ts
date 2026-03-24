import { NextResponse } from 'next/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { sendEmail } from '@/app/lib/messaging/email'
import { z } from 'zod'
import { parseBody, success } from '@/app/lib/api'

const sendCmaSchema = z.object({
  lead_id: z.string().uuid().optional(),
  email: z.string().email(),
  owner_name: z.string().optional(),
  property_address: z.string(),
  cma: z.object({
    market_overview: z.string(),
    comparables: z.array(z.object({
      address: z.string(),
      sold_price: z.string(),
      sold_date: z.string(),
      sqft: z.number(),
      price_per_sqft: z.string(),
      notes: z.string(),
    })),
    price_analysis: z.object({
      low_estimate: z.string(),
      mid_estimate: z.string(),
      high_estimate: z.string(),
      price_per_sqft_range: z.string(),
      recommended_list_price: z.string(),
      reasoning: z.string(),
    }),
    market_trends: z.array(z.string()),
    recommendations: z.array(z.string()),
    disclaimer: z.string(),
  }),
})

/**
 * POST /api/cma/send
 * Send a generated CMA report via email to a lead.
 */
export async function POST(request: Request) {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const parsed = await parseBody(request, sendCmaSchema)
  if (!parsed.ok) return parsed.response

  const { email, owner_name, property_address, cma } = parsed.data
  const name = owner_name || 'there'

  const compsHtml = cma.comparables.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.address}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;">${c.sold_price}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.sold_date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.sqft} sqft</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.price_per_sqft}/sqft</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;color:#333;">
      <div style="background:#0a0a0f;color:#fff;padding:32px;border-radius:12px 12px 0 0;">
        <h1 style="margin:0;font-size:24px;">Comparative Market Analysis</h1>
        <p style="margin:8px 0 0;opacity:0.7;font-size:14px;">${property_address}</p>
        <p style="margin:4px 0 0;opacity:0.5;font-size:12px;">Prepared for ${name}</p>
      </div>

      <div style="border:1px solid #eee;border-top:0;padding:24px;border-radius:0 0 12px 12px;">
        <p style="font-size:14px;line-height:1.6;">${cma.market_overview}</p>

        <div style="text-align:center;padding:24px;margin:20px 0;background:#f8fdf8;border-radius:8px;border:1px solid #d4edda;">
          <p style="margin:0;font-size:12px;color:#666;">Recommended List Price</p>
          <p style="margin:8px 0 0;font-size:36px;font-weight:bold;color:#22c55e;">${cma.price_analysis.recommended_list_price}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999;">Range: ${cma.price_analysis.low_estimate} — ${cma.price_analysis.high_estimate}</p>
        </div>

        <h2 style="font-size:18px;margin:24px 0 12px;">Comparable Sales</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f9f9f9;">
              <th style="padding:8px 12px;text-align:left;">Address</th>
              <th style="padding:8px 12px;text-align:left;">Sold Price</th>
              <th style="padding:8px 12px;text-align:left;">Date</th>
              <th style="padding:8px 12px;text-align:left;">Size</th>
              <th style="padding:8px 12px;text-align:left;">$/sqft</th>
            </tr>
          </thead>
          <tbody>${compsHtml}</tbody>
        </table>

        <p style="font-size:13px;color:#666;margin-top:16px;">${cma.price_analysis.reasoning}</p>

        <h2 style="font-size:18px;margin:24px 0 12px;">Market Trends</h2>
        <ul style="font-size:13px;color:#666;padding-left:20px;">
          ${cma.market_trends.map(t => `<li style="margin:6px 0;">${t}</li>`).join('')}
        </ul>

        <h2 style="font-size:18px;margin:24px 0 12px;">Recommendations</h2>
        <ul style="font-size:13px;color:#666;padding-left:20px;">
          ${cma.recommendations.map(r => `<li style="margin:6px 0;">${r}</li>`).join('')}
        </ul>

        <p style="font-size:10px;color:#999;margin-top:24px;padding-top:16px;border-top:1px solid #eee;">${cma.disclaimer}</p>
      </div>
    </div>
  `

  try {
    await sendEmail({
      to: email,
      subject: `Market Analysis: ${property_address}`,
      text: `CMA for ${property_address}\n\nRecommended Price: ${cma.price_analysis.recommended_list_price}\nRange: ${cma.price_analysis.low_estimate} - ${cma.price_analysis.high_estimate}\n\n${cma.market_overview}`,
      html,
    })

    await logActivity(
      auth.user.id,
      'cma_sent',
      `CMA emailed to ${email} for ${property_address}`,
      'success',
      { email, property_address },
    )

    return NextResponse.json(success({ sent: true, email }))
  } catch (error) {
    console.error('CMA email send error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
