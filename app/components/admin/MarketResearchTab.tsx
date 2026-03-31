'use client'

import { useState, useEffect } from 'react'
import { Card, StatCard, Badge, DeptTab } from './AdminShared'
import type { Task, ResearchFinding } from './admin-types'

const SOURCE_LABELS: Record<string, string> = {
  competitor_pricing: 'Competitor',
  product_hunt: 'Product Hunt',
  user_feedback: 'User Feedback',
  trend: 'Trend',
  usage_analysis: 'Usage',
}

interface MarketResearchTabProps {
  tasks: Task[]
  onToggle: (id: string, status: string) => void
}

export default function MarketResearchTab({ tasks, onToggle }: MarketResearchTabProps) {
  const [findings, setFindings] = useState<ResearchFinding[]>([])
  const [findingsLoading, setFindingsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/research/findings?limit=50')
      .then(r => r.json())
      .then(data => { if (data.ok) setFindings(data.findings) })
      .catch(console.error)
      .finally(() => setFindingsLoading(false))
  }, [])

  const handleFindingAction = async (id: string, status: 'accepted' | 'rejected') => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    try {
      await fetch('/api/research/findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
    } catch { /* revert on error */ }
  }

  const newFindings = findings.filter(f => f.status === 'new')
  const acceptedFindings = findings.filter(f => f.status === 'accepted')
  const rejectedFindings = findings.filter(f => f.status === 'rejected')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Findings" value={findings.length} sub="all time" />
        <StatCard label="Pending Review" value={newFindings.length} sub="needs decision" alert={newFindings.length > 5 ? 'amber' : undefined} />
        <StatCard label="Accepted" value={acceptedFindings.length} sub={'\u2192 engineering backlog'} />
        <StatCard label="Rejected" value={rejectedFindings.length} sub="not actionable" />
      </div>

      {/* New findings requiring action */}
      <Card title={`New Findings (${newFindings.length})`} accent="#AA66FF">
        {findingsLoading ? (
          <div className="py-4 text-center text-[var(--text-secondary)] text-sm">Loading findings...</div>
        ) : newFindings.length === 0 ? (
          <div className="py-4 text-center text-[var(--text-secondary)] text-sm">No new findings. Run /market-research:competitors to generate.</div>
        ) : (
          <div className="space-y-2">
            {newFindings.map(f => (
              <div key={f.id} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface-elevated)] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge text={SOURCE_LABELS[f.source] || f.source} variant="purple" />
                    <Badge text={f.priority} variant={f.priority === 'P0' ? 'red' : f.priority === 'P1' ? 'amber' : 'default'} />
                    {f.competitor_name && <span className="text-[11px] text-[var(--text-secondary)]">{f.competitor_name}</span>}
                  </div>
                  <div className="text-[13px] text-[var(--text-primary)]">{f.summary}</div>
                  {f.recommended_action && (
                    <div className="text-[11px] text-[var(--primary)] mt-1">Action: {f.recommended_action}</div>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => handleFindingAction(f.id, 'accepted')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer">
                    Accept
                  </button>
                  <button onClick={() => handleFindingAction(f.id, 'rejected')}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Competitor comparison matrix — hardcoded point-in-time snapshot */}
      <Card title="Competitor Feature Matrix" accent="#4488FF">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Badge text="Point-in-time snapshot" variant="amber" />
          <span className="text-[11px] text-[var(--text-secondary)]">Last updated: Mar 2026 &middot; Run <code className="bg-[var(--surface-elevated)] px-1 rounded text-[10px]">/market-research:competitors</code> to refresh findings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Feature', 'Estate AI', 'FUB', 'kvCORE', 'Structurely', 'Sierra'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'AI Lead Qualification', us: true, fub: false, kv: true, struct: true, sierra: false },
                { feature: 'WhatsApp Integration', us: true, fub: false, kv: false, struct: false, sierra: false },
                { feature: 'SMS Automation', us: true, fub: true, kv: true, struct: true, sierra: true },
                { feature: 'Email Campaigns', us: true, fub: true, kv: true, struct: false, sierra: true },
                { feature: 'Smart Calendar', us: true, fub: false, kv: true, struct: false, sierra: false },
                { feature: 'Starting Price', us: '$99', fub: '$69', kv: '$499', struct: '$179', sierra: '$499' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-[var(--surface-elevated)] transition-colors">
                  <td className="px-3 py-2 text-sm text-[var(--text-primary)] border-b border-[var(--border)]">{row.feature}</td>
                  {[row.us, row.fub, row.kv, row.struct, row.sierra].map((val, j) => (
                    <td key={j} className="px-3 py-2 text-sm border-b border-[var(--border)]">
                      {typeof val === 'boolean' ? (
                        <span className={val ? 'text-emerald-400' : 'text-red-400'}>{val ? '\u2713' : '\u2717'}</span>
                      ) : (
                        <span className={j === 0 ? 'text-[var(--primary)] font-semibold' : 'text-[var(--text-secondary)]'}>{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Department tasks */}
      <DeptTab department="market_research" tasks={tasks} onToggle={onToggle} filters={['P1', 'P2', 'auto']} />
    </div>
  )
}
