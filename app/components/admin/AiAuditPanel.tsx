'use client'

import { useState, useEffect } from 'react'

interface AuditEntry {
  id: string
  leadId: string | null
  messageCount: number
  auditWeek: string
  scores: { relevance: number; qualification: number; tone: number; compliance: number; escalation: number }
  overallScore: number
  aiNotes: string
  createdAt: string
}

interface AuditData {
  ok: boolean
  totalAudited: number
  avgScore: number
  distribution: { excellent: number; good: number; fair: number; poor: number }
  weeks: string[]
  audits: AuditEntry[]
}

function scoreColor(score: number) {
  if (score >= 4.5) return 'text-emerald-400'
  if (score >= 3.5) return 'text-lime-400'
  if (score >= 2.5) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number) {
  if (score >= 4.5) return 'bg-emerald-500/10'
  if (score >= 3.5) return 'bg-lime-400/10'
  if (score >= 2.5) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

export default function AiAuditPanel() {
  const [data, setData] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const loadData = () => {
    setLoading(true)
    fetch('/api/admin/ai-audit')
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleRunAudit = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/ai-audit', { method: 'POST' })
      const result = await res.json()
      if (result.ok) {
        loadData()
      }
    } catch { /* ignore */ }
    finally { setRunning(false) }
  }

  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center gap-2 py-4 justify-center text-[var(--text-secondary)] text-sm">
          <span className="animate-spin">↻</span> Loading audit data...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #FFB800, transparent)' }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px]">AI Conversation Quality Audit</div>
          <button
            onClick={handleRunAudit}
            disabled={running}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run Audit Now'}
          </button>
        </div>

        {!data || data.totalAudited === 0 ? (
          <div className="py-6 text-center text-[var(--text-secondary)] text-sm">
            No audits run yet. Click &ldquo;Run Audit Now&rdquo; to analyze recent conversations.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="px-3 py-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Audited</div>
                <div className="text-2xl font-bold text-[var(--text-primary)] mt-0.5">{data.totalAudited}</div>
              </div>
              <div className="px-3 py-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Avg Score</div>
                <div className={`text-2xl font-bold mt-0.5 ${scoreColor(data.avgScore)}`}>{data.avgScore}/5</div>
              </div>
              <div className="px-3 py-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Excellent</div>
                <div className="text-2xl font-bold text-emerald-400 mt-0.5">{data.distribution.excellent}</div>
              </div>
              <div className="px-3 py-2.5 rounded-lg border border-[var(--border)]">
                <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">Poor</div>
                <div className="text-2xl font-bold text-red-400 mt-0.5">{data.distribution.poor}</div>
              </div>
            </div>

            {/* Audit table — worst scores first */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Score', 'Relevance', 'Qualification', 'Tone', 'Compliance', 'Escalation', 'Messages', 'Notes'].map(h => (
                      <th key={h} className="text-left px-2.5 py-2 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.audits.slice(0, 20).map(a => (
                    <tr key={a.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                      <td className={`px-2.5 py-2 text-sm font-bold border-b border-[var(--border)] ${scoreColor(a.overallScore)}`}>
                        <span className={`px-1.5 py-0.5 rounded ${scoreBg(a.overallScore)}`}>{a.overallScore}</span>
                      </td>
                      {(['relevance', 'qualification', 'tone', 'compliance', 'escalation'] as const).map(dim => (
                        <td key={dim} className={`px-2.5 py-2 text-xs border-b border-[var(--border)] ${scoreColor(a.scores[dim])}`}>
                          {a.scores[dim]}/5
                        </td>
                      ))}
                      <td className="px-2.5 py-2 text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">{a.messageCount}</td>
                      <td className="px-2.5 py-2 text-[11px] text-[var(--text-secondary)] border-b border-[var(--border)] max-w-[200px] truncate">{a.aiNotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
