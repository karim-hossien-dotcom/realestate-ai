'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface FeatureData {
  name: string
  count: number
  uniqueUsers: number
}

interface TimeSeriesPoint {
  date: string
  count: number
}

interface AnalyticsData {
  ok: boolean
  period: string
  totalEvents: number
  features: FeatureData[]
  timeSeries: TimeSeriesPoint[]
}

export default function FeatureUsagePanel() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/analytics?period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  if (loading) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center gap-2 py-4 justify-center text-[var(--text-secondary)] text-sm">
          <span className="animate-spin">↻</span> Loading analytics...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="py-4 text-center text-[var(--text-secondary)] text-sm">Failed to load analytics data.</div>
      </div>
    )
  }

  const top10Features = data.features.slice(0, 10)

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #4488FF, transparent)' }} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px]">Feature Usage Analytics</div>
          <div className="flex gap-1.5">
            {(['7d', '30d', '90d'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  period === p
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-[var(--text-secondary)] mb-4">
          {data.totalEvents.toLocaleString()} total events in the last {period.replace('d', ' days')}
        </div>

        {/* Feature usage bar chart */}
        {top10Features.length > 0 ? (
          <div className="mb-6">
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Top Features</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top10Features} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} width={100} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value) => [String(value), 'Events']}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-6 text-center text-[var(--text-secondary)] text-sm">No activity data yet.</div>
        )}

        {/* Daily activity line chart */}
        {data.timeSeries.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Daily Activity</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#8891A8', fontSize: 10 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickFormatter={d => d.slice(5)}
                />
                <YAxis tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} name="Events" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
