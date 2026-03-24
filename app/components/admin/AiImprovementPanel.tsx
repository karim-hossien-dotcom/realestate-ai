'use client'

import { useState, useEffect, useCallback } from 'react'

type Improvement = {
  id: string
  category: string
  title: string
  description: string
  current_behavior: string | null
  proposed_behavior: string
  affected_rule: string | null
  evidence: string[] | null
  priority: string
  status: string
  avg_score_before: number | null
  conversations_affected: number
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

type Summary = {
  total: number
  pending: number
  accepted: number
  rejected: number
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  low: 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border)]',
}

const CATEGORY_LABELS: Record<string, string> = {
  prompt_rule: 'Prompt Rule',
  tone: 'Tone & Style',
  objection_handling: 'Objection Handling',
  qualification: 'Qualification',
  campaign_context: 'Campaign Context',
  compliance: 'Compliance',
  escalation: 'Escalation',
  general: 'General',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-400',
  accepted: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
  implemented: 'bg-blue-500/10 text-blue-400',
}

export default function AiImprovementPanel() {
  const [improvements, setImprovements] = useState<Improvement[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, pending: 0, accepted: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending')

  const fetchImprovements = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-improvements')
      const data = await res.json()
      if (data.ok) {
        setImprovements(data.improvements)
        setSummary(data.summary)
      }
    } catch (err) {
      console.error('Failed to fetch AI improvements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImprovements()
  }, [fetchImprovements])

  const handleAction = async (id: string, action: 'accept' | 'reject') => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/admin/ai-improvements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (data.ok) {
        setImprovements(prev =>
          prev.map(i => i.id === id ? { ...i, status: data.status, reviewed_at: new Date().toISOString() } : i)
        )
        setSummary(prev => ({
          ...prev,
          pending: prev.pending - 1,
          [action === 'accept' ? 'accepted' : 'rejected']: prev[action === 'accept' ? 'accepted' : 'rejected'] + 1,
        }))
      }
    } catch (err) {
      console.error('Failed to update improvement:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const filtered = improvements.filter(i =>
    filter === 'all' ? true : i.status === filter
  )

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-[var(--surface-elevated)] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => setFilter('pending')} className={`p-3 rounded-xl border text-center transition-colors ${filter === 'pending' ? 'border-amber-500/50 bg-amber-500/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          <p className="text-2xl font-bold text-amber-400">{summary.pending}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Pending Review</p>
        </button>
        <button onClick={() => setFilter('accepted')} className={`p-3 rounded-xl border text-center transition-colors ${filter === 'accepted' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          <p className="text-2xl font-bold text-emerald-400">{summary.accepted}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Accepted</p>
        </button>
        <button onClick={() => setFilter('rejected')} className={`p-3 rounded-xl border text-center transition-colors ${filter === 'rejected' ? 'border-red-500/50 bg-red-500/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          <p className="text-2xl font-bold text-red-400">{summary.rejected}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Rejected</p>
        </button>
        <button onClick={() => setFilter('all')} className={`p-3 rounded-xl border text-center transition-colors ${filter === 'all' ? 'border-blue-500/50 bg-blue-500/5' : 'border-[var(--border)] bg-[var(--surface)]'}`}>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{summary.total}</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Total</p>
        </button>
      </div>

      {/* Improvement Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
          {filter === 'pending' ? 'No pending improvements to review. The AI agent is performing well!' : `No ${filter} improvements.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id
            return (
              <div key={item.id} className="border border-[var(--border)] rounded-xl bg-[var(--surface)] overflow-hidden">
                {/* Header — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[item.priority]}`}>
                      {item.priority.toUpperCase()}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {CATEGORY_LABELS[item.category] || item.category}
                        {item.affected_rule && ` · ${item.affected_rule}`}
                        {item.conversations_affected > 0 && ` · ${item.conversations_affected} convos affected`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] ml-2">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
                    <p className="text-sm text-[var(--text-secondary)] pt-3">{item.description}</p>

                    {item.current_behavior && (
                      <div>
                        <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Current Behavior</p>
                        <div className="text-xs text-[var(--text-secondary)] bg-red-500/5 border border-red-500/10 rounded-lg p-3 font-mono">
                          {item.current_behavior}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Proposed Change</p>
                      <div className="text-xs text-[var(--text-primary)] bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 font-mono">
                        {item.proposed_behavior}
                      </div>
                    </div>

                    {item.evidence && item.evidence.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Evidence</p>
                        <div className="space-y-1">
                          {item.evidence.map((e, i) => (
                            <div key={i} className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-2 font-mono">
                              {e}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.avg_score_before && (
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Avg quality score before: <span className="font-bold text-amber-400">{item.avg_score_before.toFixed(1)}/5</span>
                      </p>
                    )}

                    {item.rejection_reason && (
                      <p className="text-xs text-red-400 italic">Rejection reason: {item.rejection_reason}</p>
                    )}

                    {/* Action Buttons */}
                    {item.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleAction(item.id, 'accept')}
                          disabled={actionLoading === item.id}
                          className="flex-1 py-2 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === item.id ? 'Saving...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          disabled={actionLoading === item.id}
                          className="flex-1 py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === item.id ? 'Saving...' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
