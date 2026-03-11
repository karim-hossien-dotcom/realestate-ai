import { createServiceClient } from '@/app/lib/supabase/server'
import OpenAI from 'openai'

interface AuditScores {
  relevance: number
  qualification: number
  tone: number
  compliance: number
  escalation: number
}

interface AuditResult {
  leadId: string
  userId: string
  messageCount: number
  scores: AuditScores
  overallScore: number
  aiNotes: string
  sampleMessages: Array<{ role: string; body: string }>
}

const AUDIT_PROMPT = `You are an AI conversation quality auditor for a real estate CRM called Estate AI.

Analyze the following conversation between an AI agent and a lead. Score each dimension from 1-5:

1. **Relevance** (1-5): Are AI responses relevant to the lead's questions/needs?
2. **Qualification** (1-5): Does the AI properly qualify the lead (budget, timeline, preferences)?
3. **Tone** (1-5): Is the tone professional, warm, and appropriate for real estate?
4. **Compliance** (1-5): Does the AI avoid making promises, legal claims, or sharing private info?
5. **Escalation** (1-5): Does the AI know when to hand off to a human agent?

Respond ONLY with valid JSON (no markdown, no explanation):
{"relevance":N,"qualification":N,"tone":N,"compliance":N,"escalation":N,"notes":"Brief assessment"}`

export async function runWeeklyAudit(): Promise<{ audited: number; avgScore: number }> {
  const supabase = createServiceClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const auditWeek = new Date().toISOString().split('T')[0]

  // Find leads with 3+ messages in the last 7 days
  const { data: activeLeads } = await supabase
    .from('messages')
    .select('lead_id, user_id')
    .gte('created_at', weekAgo)
    .not('lead_id', 'is', null)

  if (!activeLeads || activeLeads.length === 0) {
    return { audited: 0, avgScore: 0 }
  }

  // Count messages per lead and filter for 3+
  const leadMsgCount: Record<string, { count: number; userId: string }> = {}
  for (const msg of activeLeads) {
    if (!msg.lead_id) continue
    if (!leadMsgCount[msg.lead_id]) {
      leadMsgCount[msg.lead_id] = { count: 0, userId: msg.user_id }
    }
    leadMsgCount[msg.lead_id].count++
  }

  const eligibleLeads = Object.entries(leadMsgCount)
    .filter(([, v]) => v.count >= 3)
    .map(([leadId, v]) => ({ leadId, userId: v.userId, count: v.count }))

  // Sample up to 50 conversations
  const sampled = eligibleLeads.slice(0, 50)
  const results: AuditResult[] = []

  for (const { leadId, userId, count } of sampled) {
    // Get conversation messages
    const { data: messages } = await supabase
      .from('messages')
      .select('direction, body, created_at')
      .eq('lead_id', leadId)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: true })
      .limit(20)

    if (!messages || messages.length < 3) continue

    const conversationText = messages
      .map(m => `${m.direction === 'inbound' ? 'LEAD' : 'AI AGENT'}: ${m.body}`)
      .join('\n')

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: AUDIT_PROMPT },
          { role: 'user', content: conversationText },
        ],
        temperature: 0.2,
        max_tokens: 300,
      })

      const content = completion.choices[0]?.message?.content?.trim()
      if (!content) continue

      const parsed = JSON.parse(content) as AuditScores & { notes?: string }
      const scores: AuditScores = {
        relevance: Math.min(5, Math.max(1, parsed.relevance)),
        qualification: Math.min(5, Math.max(1, parsed.qualification)),
        tone: Math.min(5, Math.max(1, parsed.tone)),
        compliance: Math.min(5, Math.max(1, parsed.compliance)),
        escalation: Math.min(5, Math.max(1, parsed.escalation)),
      }

      const overall = (scores.relevance + scores.qualification + scores.tone + scores.compliance + scores.escalation) / 5

      results.push({
        leadId,
        userId,
        messageCount: count,
        scores,
        overallScore: Math.round(overall * 10) / 10,
        aiNotes: parsed.notes || '',
        sampleMessages: messages.slice(0, 5).map(m => ({
          role: m.direction === 'inbound' ? 'lead' : 'agent',
          body: (m.body || '').slice(0, 300),
        })),
      })
    } catch {
      // Skip conversations that fail to parse
      continue
    }
  }

  // Write results to DB
  if (results.length > 0) {
    const rows = results.map(r => ({
      conversation_lead_id: r.leadId,
      conversation_user_id: r.userId,
      message_count: r.messageCount,
      audit_week: auditWeek,
      scores: r.scores,
      overall_score: r.overallScore,
      ai_notes: r.aiNotes,
      sample_messages: r.sampleMessages,
    }))

    await supabase.from('ai_audits').insert(rows)
  }

  const avgScore = results.length > 0
    ? Math.round((results.reduce((sum, r) => sum + r.overallScore, 0) / results.length) * 10) / 10
    : 0

  return { audited: results.length, avgScore }
}
