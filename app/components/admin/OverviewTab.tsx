'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import FeatureUsagePanel from './FeatureUsagePanel'
import NpsResultsPanel from './NpsResultsPanel'
import AlertsPanel from './AlertsPanel'
import { Card, StatCard, Badge, TaskRow } from './AdminShared'
import {
  DEPT_COLORS, HEALTH_DOT,
  type Task, type Summary, type SystemAlert, type RevenueInfo, type DailyDigest,
} from './admin-types'

interface OverviewTabProps {
  tasks: Task[]
  onToggle: (id: string, status: string) => void
  summary: Summary
  alerts: SystemAlert[]
  revenue: RevenueInfo
}

export default function OverviewTab({ tasks, onToggle, summary, alerts, revenue }: OverviewTabProps) {
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [digestLoading, setDigestLoading] = useState(true)
  const [digestDate, setDigestDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    setDigestLoading(true)
    fetch(`/api/admin/daily-digest?date=${digestDate}`)
      .then(r => r.json())
      .then(data => { if (data.ok) setDigest(data) })
      .catch(console.error)
      .finally(() => setDigestLoading(false))
  }, [digestDate])

  const p0Tasks = tasks.filter(t => t.priority === 'P0' && t.status !== 'completed')
  const pct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0
  const watchCount = tasks.filter(t => t.department === 'finance' && t.alert_status === 'watch').length

  return (
    <div className="space-y-6">
      {/* Daily Digest Summary */}
      <Card accent={digest?.overall_health === 'red' ? '#FF4444' : digest?.overall_health === 'yellow' ? '#FFB800' : '#22C55E'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Daily Operations Digest</span>
            {digest && (
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{
                background: `${HEALTH_DOT[digest.overall_health]?.color || '#6B7280'}20`,
                color: HEALTH_DOT[digest.overall_health]?.color || '#6B7280',
              }}>
                {HEALTH_DOT[digest.overall_health]?.label || 'Unknown'}
              </span>
            )}
          </div>
          <input
            type="date"
            value={digestDate}
            onChange={e => setDigestDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-xs bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--text-primary)]"
          />
        </div>

        {digestLoading ? (
          <div className="flex items-center gap-2 py-3 justify-center text-[var(--text-secondary)] text-sm">
            <span className="animate-spin">{'\u21BB'}</span> Loading digest...
          </div>
        ) : !digest ? (
          <div className="py-3 text-center text-[var(--text-secondary)] text-sm">
            No daily report for this date. Run <code className="text-[var(--primary)]">/daily-ops:run</code> or trigger cron.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Department health indicators */}
            <div className="flex gap-3">
              {['market_research', 'finance', 'legal', 'engineering', 'marketing'].map(dept => {
                const health = digest.department_health[dept] || 'gray'
                const dot = HEALTH_DOT[health] || HEALTH_DOT.gray
                const labels: Record<string, string> = { market_research: 'Research', finance: 'Finance', legal: 'Legal', engineering: 'Engineering', marketing: 'Marketing' }
                return (
                  <div key={dept} className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: dot.color, boxShadow: `0 0 6px ${dot.color}40` }} />
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{labels[dept]}</span>
                    </div>
                    <span className="text-xs" style={{ color: dot.color }}>{dot.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Key metrics */}
            {Object.keys(digest.metrics).length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(digest.metrics).map(([key, val]) => (
                  <div key={key} className="px-3 py-2 rounded-lg border border-[var(--border)]">
                    <div className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">{key.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions taken */}
            {digest.actions_taken.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-2">Actions Taken ({digest.actions_taken.length})</div>
                <div className="space-y-1">
                  {digest.actions_taken.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                      <span className="text-emerald-400">{'\u2713'}</span> {a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions proposed */}
            {digest.actions_proposed.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-2">Proposed Actions ({digest.actions_proposed.length})</div>
                <div className="space-y-1">
                  {digest.actions_proposed.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                      <span className="text-amber-400">{'\u2192'}</span> {a}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blockers */}
            {digest.blockers.length > 0 && (
              <div className="px-3 py-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="text-[11px] font-semibold text-red-400 uppercase tracking-wide mb-2">Blockers ({digest.blockers.length})</div>
                <div className="space-y-1">
                  {digest.blockers.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-300">
                      <span>{'\u26A0'}</span> {b}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Findings */}
            {digest.findings.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-[var(--primary)] uppercase tracking-wide mb-2">Findings ({digest.findings.length})</div>
                <div className="space-y-1">
                  {digest.findings.slice(0, 8).map((f, i) => (
                    <div key={i} className="text-xs text-[var(--text-secondary)]">{'\u2022'} {f}</div>
                  ))}
                  {digest.findings.length > 8 && (
                    <div className="text-[11px] text-[var(--text-secondary)]">+ {digest.findings.length - 8} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Launch readiness */}
      <Card accent="var(--primary)">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Launch Readiness</span>
          <span className="text-2xl font-bold text-[var(--primary)]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--surface-elevated)]">
          <div className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-emerald-400 transition-all duration-1000"
            style={{ width: `${pct}%`, boxShadow: '0 0 12px rgba(79,123,247,0.3)' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-[var(--text-secondary)]">{summary.completed} of {summary.total} tasks done</span>
          <span className="text-[11px] text-[var(--text-secondary)]">{summary.blockers} blockers remaining</span>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Launch Blockers" value={summary.blockers} sub="Must fix before go-live" alert="red" />
        <StatCard label="Total Tasks" value={summary.total} sub={`${summary.automatable} automatable`} />
        <StatCard label="Finance Alerts" value={watchCount} sub="Metrics to watch" alert={watchCount > 2 ? 'amber' : undefined} />
        <StatCard label="Completed" value={summary.completed} sub={`${pct}% done`} />
      </div>

      {/* System Health inline */}
      <AlertsPanel alerts={alerts} loading={false} />

      {/* Feature Usage Analytics */}
      <FeatureUsagePanel />

      {/* NPS Survey Results */}
      <NpsResultsPanel />

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Revenue (12-month MRR)" accent="var(--primary)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenue.revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${v}`} />
              <Area type="monotone" dataKey="rev" stroke="var(--primary)" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="cost" stroke="#FF4444" strokeWidth={1.5} fill="none" name="Costs" strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Tasks by Department" accent="#AA66FF">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={[
                  { name: 'Legal', value: summary.byDepartment.legal },
                  { name: 'Engineering', value: summary.byDepartment.engineering },
                  { name: 'Marketing', value: summary.byDepartment.marketing },
                  { name: 'Finance', value: summary.byDepartment.finance },
                  { name: 'Market Research', value: summary.byDepartment.market_research },
                ]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  <Cell fill={DEPT_COLORS.legal} />
                  <Cell fill={DEPT_COLORS.engineering} />
                  <Cell fill={DEPT_COLORS.marketing} />
                  <Cell fill={DEPT_COLORS.finance} />
                  <Cell fill={DEPT_COLORS.market_research} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-0">
              {([
                { label: 'Legal', count: summary.byDepartment.legal, color: DEPT_COLORS.legal },
                { label: 'Engineering', count: summary.byDepartment.engineering, color: DEPT_COLORS.engineering },
                { label: 'Marketing', count: summary.byDepartment.marketing, color: DEPT_COLORS.marketing },
                { label: 'Finance', count: summary.byDepartment.finance, color: DEPT_COLORS.finance },
                { label: 'Market Research', count: summary.byDepartment.market_research, color: DEPT_COLORS.market_research },
              ] as const).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm" style={{ background: item.color }} />
                    <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* P0 blockers */}
      {p0Tasks.length > 0 && (
        <Card title={`Launch Blockers (${p0Tasks.length})`} accent="#FF4444">
          {p0Tasks.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
        </Card>
      )}

      {/* Automation + completions */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Automation Split (open tasks)" accent="#AA66FF">
          <div className="space-y-4 py-2">
            {(() => {
              const openCount = summary.total - summary.completed
              const needsYou = openCount - summary.automatable
              return (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/15">
                    <div className="text-4xl font-bold text-[var(--primary)]">{summary.automatable}</div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">AI-Assisted</div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Health checks, content drafts, research, templates</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
                    <div className="text-4xl font-bold text-[var(--text-secondary)]">{needsYou}</div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Needs You</div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Account setup, vendor registration, ad launches</div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </Card>

        <Card title="Recent Completions" accent="#22C55E">
          {tasks.filter(t => t.status === 'completed').length === 0 ? (
            <div className="py-5 text-center text-[var(--text-secondary)] text-sm">No tasks completed yet.</div>
          ) : (
            tasks.filter(t => t.status === 'completed').slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-emerald-400 text-xs">{'\u2713'}</span>
                  <span className="text-xs text-[var(--text-primary)] truncate">{t.title}</span>
                </div>
                <Badge text={t.completed_by === 'claude_code' ? 'Claude' : t.completed_by || 'user'}
                  variant={t.completed_by === 'claude_code' ? 'purple' : 'default'} />
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
