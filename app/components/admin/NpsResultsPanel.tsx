'use client'

import { useState, useEffect } from 'react'

interface NpsData {
  ok: boolean
  npsScore: number | null
  totalResponses: number
  distribution: { promoters: number; passives: number; detractors: number }
  recentFeedback: Array<{ score: number; feedback: string; createdAt: string }>
}

export default function NpsResultsPanel() {
  const [data, setData] = useState<NpsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/nps')
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center gap-2 py-4 justify-center text-[var(--text-secondary)] text-sm">
          <span className="animate-spin">↻</span> Loading NPS data...
        </div>
      </div>
    )
  }

  if (!data || data.totalResponses === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #AA66FF, transparent)' }} />
        <div className="p-5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px] mb-4">NPS Survey Results</div>
          <div className="py-4 text-center text-[var(--text-secondary)] text-sm">No NPS responses yet. Widget shows after 7 days of account age.</div>
        </div>
      </div>
    )
  }

  const { npsScore, totalResponses, distribution, recentFeedback } = data
  const total = distribution.promoters + distribution.passives + distribution.detractors
  const pctPromoters = total > 0 ? Math.round((distribution.promoters / total) * 100) : 0
  const pctPassives = total > 0 ? Math.round((distribution.passives / total) * 100) : 0
  const pctDetractors = total > 0 ? Math.round((distribution.detractors / total) * 100) : 0

  const scoreColor = npsScore !== null
    ? npsScore >= 50 ? 'text-emerald-400' : npsScore >= 0 ? 'text-amber-400' : 'text-red-400'
    : 'text-[var(--text-secondary)]'

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #AA66FF, transparent)' }} />
      <div className="p-5">
        <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px] mb-4">NPS Survey Results</div>

        {/* Score + distribution */}
        <div className="flex items-center gap-6 mb-4">
          {/* NPS score gauge */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${scoreColor}`}>{npsScore ?? '—'}</div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">NPS Score</div>
            <div className="text-[10px] text-[var(--text-secondary)]">{totalResponses} responses</div>
          </div>

          {/* Distribution bar */}
          <div className="flex-1">
            <div className="flex h-6 rounded-lg overflow-hidden">
              {pctDetractors > 0 && (
                <div className="bg-red-500/80 flex items-center justify-center" style={{ width: `${pctDetractors}%` }}>
                  <span className="text-[10px] font-bold text-white">{pctDetractors}%</span>
                </div>
              )}
              {pctPassives > 0 && (
                <div className="bg-amber-500/80 flex items-center justify-center" style={{ width: `${pctPassives}%` }}>
                  <span className="text-[10px] font-bold text-white">{pctPassives}%</span>
                </div>
              )}
              {pctPromoters > 0 && (
                <div className="bg-emerald-500/80 flex items-center justify-center" style={{ width: `${pctPromoters}%` }}>
                  <span className="text-[10px] font-bold text-white">{pctPromoters}%</span>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-red-400">Detractors ({distribution.detractors})</span>
              <span className="text-[10px] text-amber-400">Passives ({distribution.passives})</span>
              <span className="text-[10px] text-emerald-400">Promoters ({distribution.promoters})</span>
            </div>
          </div>
        </div>

        {/* Recent feedback */}
        {recentFeedback.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Recent Feedback</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentFeedback.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-[var(--border)]">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    f.score >= 9 ? 'bg-emerald-500/10 text-emerald-400' :
                    f.score >= 7 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{f.score}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-primary)]">{f.feedback}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{new Date(f.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
