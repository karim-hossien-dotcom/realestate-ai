import { NextResponse } from 'next/server'
import { createServiceClient } from '@/app/lib/supabase/server'
import OpenAI from 'openai'

const CRON_SECRET = process.env.CRON_SECRET || ''

const ANALYSIS_PROMPT = `You are an AI behavior analyst reviewing conversations between an AI real estate agent and leads.

You're given conversations that scored BELOW 4.0/5 in a quality audit. Your job is to identify SPECIFIC, ACTIONABLE improvements to the AI agent's system prompt or behavior rules.

For each issue you find, propose a concrete change. Be specific — don't say "improve tone", say exactly what the AI should say/do differently.

Categories:
- prompt_rule: Changes to the critical rules (RULE 1-7)
- tone: Voice, style, formality issues
- objection_handling: Better responses to common objections
- qualification: Missing or wrong qualification behavior
- campaign_context: AI not staying on-topic with campaign subject
- compliance: Legal/regulatory concerns
- escalation: AI should/shouldn't have escalated
- general: Other improvements

Respond ONLY with valid JSON array (no markdown):
[
  {
    "category": "one of the categories above",
    "title": "Short title (under 60 chars)",
    "description": "What's wrong and why it matters",
    "current_behavior": "What the AI is doing now (quote from conversation)",
    "proposed_behavior": "Exact wording or behavior the AI should use instead",
    "affected_rule": "RULE 5" or "QUALIFICATION CHECKLIST" or "TONE RULES" or null,
    "priority": "critical" | "high" | "medium" | "low",
    "evidence": ["Relevant conversation excerpt 1", "Excerpt 2"]
  }
]

Rules:
- Only propose changes that would meaningfully improve outcomes
- Be specific — include exact wording when possible
- Don't propose changes that conflict with existing rules
- Maximum 5 proposals per batch
- If conversations look fine despite low scores, return an empty array []`

/**
 * GET /api/cron/ai-improvement-report
 * Analyzes low-scoring AI conversations from the weekly audit and proposes
 * specific improvements. Stores proposals in ai_improvements table for admin review.
 * Schedule: Weekly (after weekly-ai-audit runs).
 */
export async function GET(request: Request) {
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url)
    const token = request.headers.get('x-cron-secret') || searchParams.get('secret')
    if (token !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceClient()
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Get low-scoring audits from the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: lowScoreAudits } = await supabase
      .from('ai_audits')
      .select('conversation_lead_id, conversation_user_id, overall_score, scores, ai_notes, sample_messages')
      .gte('created_at', weekAgo)
      .lt('overall_score', 4.0)
      .order('overall_score', { ascending: true })
      .limit(20)

    if (!lowScoreAudits || lowScoreAudits.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No low-scoring conversations to analyze',
        analyzed: 0,
        proposals: 0,
      })
    }

    // Build full conversation threads for low-scoring leads
    const conversationTexts: string[] = []
    for (const audit of lowScoreAudits.slice(0, 10)) {
      const { data: messages } = await supabase
        .from('messages')
        .select('direction, body, created_at, campaign_id')
        .eq('lead_id', audit.conversation_lead_id)
        .order('created_at', { ascending: true })
        .limit(20)

      if (!messages || messages.length < 2) continue

      // Get campaign names if any
      const campaignIds = [...new Set(messages.filter(m => m.campaign_id).map(m => m.campaign_id))]
      let campaignMap: Record<string, string> = {}
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, name')
          .in('id', campaignIds)
        campaignMap = Object.fromEntries((campaigns || []).map(c => [c.id, c.name]))
      }

      const thread = messages.map(m => {
        const role = m.direction === 'inbound' ? 'LEAD' : 'AI AGENT'
        const tag = m.campaign_id && campaignMap[m.campaign_id]
          ? ` [CAMPAIGN: ${campaignMap[m.campaign_id]}]`
          : ''
        return `${role}${tag}: ${m.body}`
      }).join('\n')

      const scores = audit.scores as Record<string, number>
      const scoreStr = Object.entries(scores).map(([k, v]) => `${k}=${v}`).join(', ')
      conversationTexts.push(
        `--- Conversation (score: ${audit.overall_score}/5, ${scoreStr}) ---\n` +
        `Auditor notes: ${audit.ai_notes}\n\n${thread}`
      )
    }

    if (conversationTexts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No conversation threads found for low-scoring audits',
        analyzed: 0,
        proposals: 0,
      })
    }

    // Ask GPT-4o to analyze and propose improvements
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        {
          role: 'user',
          content: `Analyze these ${conversationTexts.length} low-scoring conversations and propose improvements:\n\n${conversationTexts.join('\n\n')}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({
        ok: true,
        message: 'AI analysis returned empty response',
        analyzed: conversationTexts.length,
        proposals: 0,
      })
    }

    // Parse proposals
    let proposals: Array<{
      category: string
      title: string
      description: string
      current_behavior: string
      proposed_behavior: string
      affected_rule: string | null
      priority: string
      evidence: string[]
    }>

    try {
      const parsed = JSON.parse(content)
      proposals = Array.isArray(parsed) ? parsed : parsed.proposals || parsed.improvements || []
    } catch {
      console.error('Failed to parse AI improvement proposals:', content.slice(0, 200))
      return NextResponse.json({
        ok: false,
        error: 'Failed to parse AI response',
        analyzed: conversationTexts.length,
      }, { status: 500 })
    }

    if (proposals.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No improvements proposed — conversations look acceptable',
        analyzed: conversationTexts.length,
        proposals: 0,
      })
    }

    // Dedup against existing pending proposals (by title similarity)
    const { data: existingProposals } = await supabase
      .from('ai_improvements')
      .select('title')
      .eq('status', 'pending')

    const existingTitles = new Set((existingProposals || []).map(p => p.title.toLowerCase()))

    const newProposals = proposals.filter(p =>
      !existingTitles.has(p.title.toLowerCase())
    )

    // Insert new proposals
    if (newProposals.length > 0) {
      const rows = newProposals.map(p => ({
        category: p.category,
        title: p.title,
        description: p.description,
        current_behavior: p.current_behavior,
        proposed_behavior: p.proposed_behavior,
        affected_rule: p.affected_rule,
        priority: p.priority,
        evidence: p.evidence,
        avg_score_before: lowScoreAudits.reduce((s, a) => s + a.overall_score, 0) / lowScoreAudits.length,
        conversations_affected: conversationTexts.length,
        source: 'weekly_audit',
      }))

      const { error: insertError } = await supabase
        .from('ai_improvements')
        .insert(rows)

      if (insertError) {
        console.error('Failed to insert AI improvement proposals:', insertError)
      }
    }

    return NextResponse.json({
      ok: true,
      analyzed: conversationTexts.length,
      low_score_count: lowScoreAudits.length,
      proposals: newProposals.length,
      duplicates_skipped: proposals.length - newProposals.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('AI improvement report error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
