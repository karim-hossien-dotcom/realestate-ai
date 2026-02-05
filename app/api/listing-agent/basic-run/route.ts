import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { withAuth, logActivity } from '@/app/lib/auth'
import { generateMessagesForLead, DEFAULT_BASE_SCRIPT } from '@/app/lib/ai/listing-agent'
import { calculateLeadScore } from '@/app/lib/ai/lead-scorer'

export async function POST() {
  const auth = await withAuth()
  if (!auth.ok) return auth.response

  const supabase = await createClient()

  // Get leads without generated messages
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('*')
    .is('sms_text', null)
    .order('created_at', { ascending: false })

  if (leadsError) {
    return NextResponse.json(
      { ok: false, error: leadsError.message },
      { status: 500 }
    )
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'No leads without messages found. Import leads first.',
      data: { leadCount: 0 },
    })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: true,
      demo: true,
      message: 'Demo mode: OPENAI_API_KEY not set. Message generation skipped.',
      data: { leadCount: leads.length },
    })
  }

  const agentName = process.env.LISTING_AGENT_NAME || 'Nadine Khalil'
  const brokerage = process.env.LISTING_AGENT_BROKERAGE || 'KW Commercial'
  let processed = 0
  const errors: string[] = []

  for (const lead of leads) {
    try {
      // Generate messages using TypeScript AI module
      const messages = await generateMessagesForLead(
        DEFAULT_BASE_SCRIPT,
        agentName,
        brokerage,
        {
          owner_name: lead.owner_name || undefined,
          property_address: lead.property_address || undefined,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
        }
      )

      // Calculate lead score
      const scoreResult = calculateLeadScore({
        status: lead.status,
        responseCount: 0,
        messagesSent: 0,
        lastResponse: lead.last_response,
        lastContacted: lead.last_contacted,
        hasPhone: !!lead.phone,
        hasEmail: !!lead.email,
      })

      // Update lead with generated messages and score
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          sms_text: messages.sms_text,
          email_text: messages.email_body,
          score: scoreResult.score,
          score_category: scoreResult.category,
        })
        .eq('id', lead.id)

      if (updateError) {
        errors.push(`Lead ${lead.id}: ${updateError.message}`)
      } else {
        processed++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Lead ${lead.id}: ${message}`)
    }
  }

  // Log activity
  await logActivity(
    auth.user.id,
    'ai_generation',
    `Generated personalized messages for ${processed} leads`,
    processed > 0 ? 'success' : 'failed',
    {
      totalLeads: leads.length,
      processed,
      errors: errors.length,
    }
  )

  return NextResponse.json({
    ok: true,
    message: `Generated personalized messages for ${processed} leads.`,
    data: {
      leadCount: processed,
      total: leads.length,
      errors: errors.length > 0 ? errors : undefined,
    },
  })
}
