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

interface OpsMetrics {
  totalMessages: number
  inbound: number
  outbound: number
  doubleReplies: number
  duplicateSends: number
  nameRepetition: number
  vagueClosers: number
  falseUnsubscribes: number
  avgResponseTimeSec: number
  uniqueLeads: number
}

/**
 * Run operational health check on messaging — detects system-level bugs
 * that the AI quality scorer can't catch (double replies, spam, duplicates).
 */
async function runOpsAudit(supabase: ReturnType<typeof createServiceClient>, since: string): Promise<OpsMetrics> {
  const metrics: OpsMetrics = {
    totalMessages: 0, inbound: 0, outbound: 0, doubleReplies: 0,
    duplicateSends: 0, nameRepetition: 0, vagueClosers: 0,
    falseUnsubscribes: 0, avgResponseTimeSec: 0, uniqueLeads: 0,
  }

  const { data: msgs } = await supabase
    .from('messages')
    .select('direction, body, from_number, to_number, created_at, status')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (!msgs || msgs.length === 0) return metrics

  metrics.totalMessages = msgs.length
  metrics.inbound = msgs.filter(m => m.direction === 'inbound').length
  metrics.outbound = msgs.filter(m => m.direction === 'outbound').length
  metrics.uniqueLeads = new Set(msgs.filter(m => m.direction === 'inbound').map(m => m.from_number)).size

  // Group by phone for conversation-level analysis
  const convos: Record<string, typeof msgs> = {}
  msgs.forEach(m => {
    const phone = m.direction === 'inbound' ? m.from_number : m.to_number
    if (!convos[phone]) convos[phone] = []
    convos[phone].push(m)
  })

  const responseTimes: number[] = []

  for (const thread of Object.values(convos)) {
    for (let i = 1; i < thread.length; i++) {
      const prev = thread[i - 1]
      const curr = thread[i]
      const gapMs = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()

      // Double replies: 2 outbound messages within 30 seconds
      if (curr.direction === 'outbound' && prev.direction === 'outbound' && gapMs < 30000) {
        metrics.doubleReplies++
      }

      // Response time: inbound → next outbound
      if (curr.direction === 'outbound' && prev.direction === 'inbound' && gapMs > 0 && gapMs < 300000) {
        responseTimes.push(gapMs / 1000)
      }
    }
  }

  // Outbound message pattern analysis
  const outbound = msgs.filter(m => m.direction === 'outbound' && m.body)

  // Name repetition: "Got it, [Name]" as opener
  metrics.nameRepetition = outbound.filter(m => /^Got it,?\s+[A-Z]/i.test(m.body || '')).length

  // Vague closers
  metrics.vagueClosers = outbound.filter(m => {
    const b = (m.body || '').toLowerCase()
    return b.includes('anything else') || b.includes('let me know if') ||
           b.includes('reach out if you need') || b.includes('good luck with your plans')
  }).length

  // False unsubscribes (unsubscribe message sent to someone who didn't say STOP)
  metrics.falseUnsubscribes = 0 // Can't fully detect retroactively, but count unsubscribe msgs
  const unsubMsgs = outbound.filter(m => (m.body || '').includes("You're unsubscribed"))
  metrics.falseUnsubscribes = unsubMsgs.length

  // Duplicate sends (same body sent 3+ times)
  const bodyCounts: Record<string, number> = {}
  outbound.forEach(m => {
    const key = (m.body || '').slice(0, 80)
    bodyCounts[key] = (bodyCounts[key] || 0) + 1
  })
  metrics.duplicateSends = Object.values(bodyCounts).filter(c => c >= 3).reduce((sum, c) => sum + c, 0)

  // Average response time
  if (responseTimes.length > 0) {
    metrics.avgResponseTimeSec = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length * 10) / 10
  }

  return metrics
}

export async function runWeeklyAudit(): Promise<{ audited: number; avgScore: number; ops?: OpsMetrics }> {
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

  // Run operational health check
  const ops = await runOpsAudit(supabase, weekAgo)

  // Store ops metrics in daily_reports for Command Center visibility
  const today = new Date().toISOString().split('T')[0]
  const opsFindings: string[] = []
  if (ops.doubleReplies > 0) opsFindings.push(`[warning] ${ops.doubleReplies} double replies detected (AI sent 2 msgs <30s apart)`)
  if (ops.duplicateSends > 0) opsFindings.push(`[critical] ${ops.duplicateSends} duplicate sends (same message sent 3+ times)`)
  if (ops.nameRepetition > 5) opsFindings.push(`[warning] ${ops.nameRepetition} replies started with "Got it, [Name]" — robotic pattern`)
  if (ops.vagueClosers > 3) opsFindings.push(`[warning] ${ops.vagueClosers} vague closers ("anything else?", "good luck")`)
  if (ops.falseUnsubscribes > 0) opsFindings.push(`[critical] ${ops.falseUnsubscribes} unsubscribe messages sent — verify these were legitimate STOP requests`)
  if (ops.avgResponseTimeSec > 30) opsFindings.push(`[warning] Avg response time ${ops.avgResponseTimeSec}s — target is <15s`)

  if (opsFindings.length > 0) {
    await supabase.from('daily_reports').upsert({
      department: 'engineering',
      report_date: today,
      health_status: opsFindings.some(f => f.includes('[critical]')) ? 'red' : 'yellow',
      metrics: {
        total_messages: ops.totalMessages,
        inbound: ops.inbound,
        outbound: ops.outbound,
        double_replies: ops.doubleReplies,
        duplicate_sends: ops.duplicateSends,
        avg_response_time_sec: ops.avgResponseTimeSec,
        unique_leads: ops.uniqueLeads,
        ai_quality_score: avgScore,
        conversations_audited: results.length,
      },
      findings: opsFindings,
      actions_taken: ['Ran weekly AI quality audit + ops health check'],
      actions_proposed: opsFindings.map(f => f.replace(/\[(warning|critical)\]\s*/, 'Fix: ')),
      blockers: opsFindings.filter(f => f.includes('[critical]')).map(f => f.replace('[critical] ', '')),
    }, { onConflict: 'department,report_date' }).then(({ error: upsertErr }) => {
      if (upsertErr) console.error('[AI Audit] Failed to write ops report:', upsertErr.message)
    })
  }

  return { audited: results.length, avgScore, ops }
}
