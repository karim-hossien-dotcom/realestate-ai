'use client'

// Purpose: Owner-only command center — track tasks, costs, launch readiness
// Tone: Dark terminal / ops dashboard
// Reference: Antimetal.com, Linear
// Differentiator: Live Supabase-connected task tracker with department breakdown + financial alerts

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import FeatureUsagePanel from '@/app/components/admin/FeatureUsagePanel'
import NpsResultsPanel from '@/app/components/admin/NpsResultsPanel'
import AiAuditPanel from '@/app/components/admin/AiAuditPanel'

// Owner user ID — only this account can access /admin
const ADMIN_USER_ID = '45435140-9a0a-49aa-a95e-5ace7657f61a'

// ── Types ──
interface Task {
  id: string
  department: string
  priority: string
  status: string
  title: string
  description?: string
  channel?: string
  is_blocker?: boolean
  is_automatable?: boolean
  week_label?: string
  metric_threshold?: string
  metric_current?: string
  alert_status?: string
  vendor_name?: string
  vendor_service?: string
  vendor_plan?: string
  vendor_action?: string
  completed_at?: string
  completed_by?: string
}

interface Summary {
  total: number
  completed: number
  blockers: number
  automatable: number
  byDepartment: { legal: number; engineering: number; marketing: number; finance: number; market_research: number }
}

interface SystemAlert {
  key: string
  category: string
  severity: 'ok' | 'warning' | 'critical'
  title: string
  message: string
  metricValue: string
  threshold: string
}

interface ResearchFinding {
  id: string
  source: string
  finding_type: string
  competitor_name?: string
  summary: string
  details: Record<string, unknown>
  recommended_action?: string
  priority: string
  status: string
  engineering_task_id?: string
  created_at: string
}

// ── API helpers ──
async function fetchTasks(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) query.set(k, String(v)) })
  const res = await fetch(`/api/tasks?${query.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

async function patchTask(id: string, updates: Record<string, unknown>) {
  const res = await fetch('/api/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}

// ── Badge colors mapped to CSS vars + Tailwind ──
const BADGE_STYLES: Record<string, string> = {
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lime: 'bg-lime-400/10 text-lime-400 border-lime-400/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  default: 'bg-[var(--badge-muted-bg)] text-[var(--text-secondary)] border-[var(--border)]',
}

function Badge({ text, variant = 'default' }: { text: string; variant?: string }) {
  const cls = BADGE_STYLES[variant] || BADGE_STYLES.default
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${cls}`}>
      {text}
    </span>
  )
}

// ── Status checkbox ──
function StatusToggle({ task, onToggle }: { task: Task; onToggle: (id: string, status: string) => void }) {
  const done = task.status === 'completed'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(task.id, done ? 'pending' : 'completed') }}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
        done ? 'border-emerald-400 bg-emerald-400/10' : 'border-[var(--border)] bg-transparent hover:border-[var(--text-secondary)]'
      }`}
      title={done ? 'Mark as pending' : 'Mark as completed'}
    >
      {done && <span className="text-emerald-400 text-xs font-bold">✓</span>}
    </button>
  )
}

// ── Task row ──
function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string, status: string) => void }) {
  const pColor = task.priority === 'P0' ? 'red' : task.priority === 'P1' ? 'amber' : 'default'
  const done = task.status === 'completed'
  const isP0Active = task.priority === 'P0' && !done
  return (
    <div className={`flex items-start justify-between gap-3 px-3.5 py-3 rounded-lg border mb-1.5 transition-all ${
      isP0Active ? 'border-red-500/20 bg-red-500/5' : 'border-[var(--border)] hover:bg-[var(--surface-elevated)]'
    } ${done ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="mt-0.5"><StatusToggle task={task} onToggle={onToggle} /></div>
        <div className="mt-0.5"><Badge text={task.priority} variant={pColor} /></div>
        <div className="min-w-0">
          <div className={`text-[13px] font-medium text-[var(--text-primary)] ${done ? 'line-through' : ''}`}>{task.title}</div>
          {task.description && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{task.description}</div>}
          {task.completed_by && done && (
            <div className="text-[10px] text-emerald-400 mt-0.5">
              Completed by {task.completed_by === 'claude_code' ? 'Claude Code' : task.completed_by}
              {task.completed_at && ` · ${new Date(task.completed_at).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {task.channel && <Badge text={task.channel} variant="blue" />}
        {task.is_blocker && !done && <Badge text="BLOCKER" variant="red" />}
        {task.is_automatable && <Badge text="AI" variant="purple" />}
        {done && <Badge text="DONE" variant="green" />}
      </div>
    </div>
  )
}

// ── Card wrapper ──
function Card({ title, accent, children, className = '' }: {
  title?: string; accent?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden ${className}`}>
      {accent && <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />}
      <div className="p-5">
        {title && <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px] mb-4">{title}</div>}
        {children}
      </div>
    </div>
  )
}

// ── Stat card ──
function StatCard({ label, value, sub, alert }: {
  label: string; value: string | number; sub?: string; alert?: string
}) {
  return (
    <div className={`bg-[var(--surface)] border rounded-xl p-5 transition-colors hover:border-[var(--primary)] ${
      alert === 'red' ? 'border-red-500/20' : alert === 'amber' ? 'border-amber-500/20' : 'border-[var(--border)]'
    }`}>
      {alert === 'red' && <div className="h-0.5 -mt-5 -mx-5 mb-4" style={{ background: 'linear-gradient(90deg, #FF4444, transparent)' }} />}
      <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[1.2px]">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${alert === 'red' ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

// ── Filter button ──
function FilterBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
      active
        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
        : 'border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`}>
      {label}
    </button>
  )
}

// ── Department tab ──
function DeptTab({ department, tasks, onToggle, filters }: {
  department: string; tasks: Task[]; onToggle: (id: string, s: string) => void; filters: string[]
}) {
  const [filter, setFilter] = useState('all')
  const [showDone, setShowDone] = useState(false)

  const deptTasks = tasks.filter(t => t.department === department)
  let filtered = filter === 'all'
    ? deptTasks
    : filter === 'auto'
      ? deptTasks.filter(t => t.is_automatable)
      : deptTasks.filter(t => t.priority === filter)

  if (!showDone) filtered = filtered.filter(t => t.status !== 'completed')
  const doneCount = deptTasks.filter(t => t.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <FilterBtn active={filter === 'all'} label={`All (${deptTasks.length})`} onClick={() => setFilter('all')} />
          {filters.map(f => (
            <FilterBtn key={f} active={filter === f}
              label={f === 'auto' ? 'AI-Assisted' : `${f} (${deptTasks.filter(t => t.priority === f).length})`}
              onClick={() => setFilter(f)} />
          ))}
        </div>
        <button onClick={() => setShowDone(!showDone)} className={`px-3.5 py-1.5 rounded-lg text-xs border transition-all cursor-pointer ${
          showDone ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[var(--border)] text-[var(--text-secondary)]'
        }`}>
          {showDone ? `Hide completed (${doneCount})` : `Show completed (${doneCount})`}
        </button>
      </div>
      {filtered.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
      {filtered.length === 0 && (
        <div className="py-10 text-center text-[var(--text-secondary)] text-sm">
          {showDone ? 'No tasks match this filter.' : 'All tasks completed!'}
        </div>
      )}
    </div>
  )
}

// ── Revenue mock data (until Stripe data flows) ──
const revenueData = Array.from({ length: 12 }, (_, i) => ({
  name: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'][i],
  rev: Math.floor(i * i * 80 + i * 200),
  cost: Math.floor(14 + i * 40 + Math.random() * 50),
}))

const DEPT_COLORS: Record<string, string> = { legal: '#FF4444', engineering: '#22C55E', marketing: '#4488FF', finance: '#FFB800', market_research: '#AA66FF' }
const TABS = ['Overview', 'Market Research', 'Legal', 'Engineering', 'Marketing', 'Finance'] as const

// ── Daily Digest types ──
interface DailyDigest {
  date: string
  overall_health: string
  department_health: Record<string, string>
  reports_filed: number
  reports_missing: number
  metrics: Record<string, string | number>
  findings: string[]
  actions_taken: string[]
  actions_proposed: string[]
  blockers: string[]
}

const HEALTH_DOT: Record<string, { color: string; label: string }> = {
  green: { color: '#22C55E', label: 'Healthy' },
  yellow: { color: '#FFB800', label: 'Warning' },
  red: { color: '#FF4444', label: 'Critical' },
  gray: { color: '#6B7280', label: 'No Report' },
}

// ── Overview tab ──
function OverviewTab({ tasks, onToggle, summary, alerts }: { tasks: Task[]; onToggle: (id: string, s: string) => void; summary: Summary; alerts: SystemAlert[] }) {
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
            <span className="animate-spin">↻</span> Loading digest...
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
                      <span className="text-emerald-400">✓</span> {a}
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
                      <span className="text-amber-400">→</span> {a}
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
                      <span>⚠</span> {b}
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
                    <div key={i} className="text-xs text-[var(--text-secondary)]">• {f}</div>
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
        <Card title="Revenue Projection (12-month)" accent="var(--primary)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
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
        <Card title="Automation Split" accent="#AA66FF">
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/15">
              <div className="text-4xl font-bold text-[var(--primary)]">{summary.automatable}</div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">AI-Assisted Tasks</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Health endpoints, alerting, content drafts, templates</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]">
              <div className="text-4xl font-bold text-[var(--text-secondary)]">{summary.total - summary.automatable}</div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Needs You</div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">Account setup, vendor registration, legal, ad launches</div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Recent Completions" accent="#22C55E">
          {tasks.filter(t => t.status === 'completed').length === 0 ? (
            <div className="py-5 text-center text-[var(--text-secondary)] text-sm">No tasks completed yet.</div>
          ) : (
            tasks.filter(t => t.status === 'completed').slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-emerald-400 text-xs">✓</span>
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

// ── Alert severity styling ──
const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  critical: { border: 'border-red-500/30', bg: 'bg-red-500/5', icon: '🔴', text: 'text-red-400' },
  warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: '🟡', text: 'text-amber-400' },
  ok: { border: 'border-emerald-500/20', bg: 'bg-transparent', icon: '🟢', text: 'text-emerald-400' },
}

// ── System Alerts Panel ──
function AlertsPanel({ alerts, loading }: { alerts: SystemAlert[]; loading: boolean }) {
  if (loading) {
    return (
      <Card title="System Health — Live" accent="#22C55E">
        <div className="flex items-center gap-2 py-4 justify-center text-[var(--text-secondary)] text-sm">
          <span className="animate-spin">↻</span> Running health checks...
        </div>
      </Card>
    )
  }

  const critical = alerts.filter(a => a.severity === 'critical')
  const warnings = alerts.filter(a => a.severity === 'warning')
  const oks = alerts.filter(a => a.severity === 'ok')
  const sorted = [...critical, ...warnings, ...oks]

  return (
    <Card title={`System Health — Live (${critical.length > 0 ? '⚠ ' + critical.length + ' critical' : warnings.length > 0 ? warnings.length + ' warning' : 'All clear'})`}
      accent={critical.length > 0 ? '#FF4444' : warnings.length > 0 ? '#FFB800' : '#22C55E'}>
      <div className="space-y-2">
        {sorted.map(a => {
          const s = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.ok
          return (
            <div key={a.key} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${s.border} ${s.bg}`}>
              <span className="text-sm mt-0.5 flex-shrink-0">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${s.text}`}>{a.title}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-[var(--text-secondary)]">{a.metricValue}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] opacity-50">/ {a.threshold}</span>
                  </div>
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{a.message}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Engineering tab (with KPI cards + live alerts) ──
function EngineeringTab({ tasks, onToggle, alerts, alertsLoading }: {
  tasks: Task[]; onToggle: (id: string, s: string) => void; alerts: SystemAlert[]; alertsLoading: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Live system alerts */}
      <AlertsPanel alerts={alerts} loading={alertsLoading} />

      <div className="grid grid-cols-2 gap-4">
        <Card title="System Targets" accent="#22C55E">
          {[
            { label: 'Uptime', val: '99.5%+', color: 'text-emerald-400' },
            { label: 'P95 Response', val: '<500ms', color: 'text-lime-400' },
            { label: 'Error Rate', val: '<0.5%', color: 'text-amber-400' },
            { label: 'Webhook Delivery', val: '99%+', color: 'text-emerald-400' },
          ].map((kpi, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-[var(--border)] last:border-0">
              <span className="text-sm text-[var(--text-primary)]">{kpi.label}</span>
              <span className={`text-sm font-bold ${kpi.color}`}>{kpi.val}</span>
            </div>
          ))}
        </Card>
        <Card title="API Routes Coverage" accent="var(--primary)">
          <div className="text-center py-2">
            <div className="text-5xl font-bold text-[var(--primary)]">32</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">API Routes · 14 Tables · 3 Channels</div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Test Coverage</span>
              <span className="text-[11px] text-amber-400">3 / 32 routes</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-elevated)]">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-400" style={{ width: '9%' }} />
            </div>
          </div>
        </Card>
      </div>
      {/* AI Conversation Quality Audit */}
      <AiAuditPanel />

      <DeptTab department="engineering" tasks={tasks} onToggle={onToggle} filters={['P0', 'P1', 'P2', 'P3', 'auto']} />
    </div>
  )
}

// ── Marketing tab ──
function MarketingTab({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string, s: string) => void }) {
  const mkt = tasks.filter(t => t.department === 'marketing')
  const autoCount = mkt.filter(t => t.is_automatable).length
  const manualCount = mkt.length - autoCount

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Website Target" value="5K" sub="visitors in 90 days" />
        <StatCard label="Signup Conv." value="3-5%" sub="visitor → trial" />
        <StatCard label="CAC Target" value="<$150" sub="per customer" />
        <StatCard label="Trial → Paid" value="20%+" sub="conversion rate" />
      </div>
      <DeptTab department="marketing" tasks={tasks} onToggle={onToggle} filters={['P1', 'P2', 'auto']} />
      <div className="grid grid-cols-2 gap-4">
        <Card title={`Needs You (${manualCount})`} accent="#FFB800">
          {mkt.filter(t => !t.is_automatable).map(t => (
            <div key={t.id} className={`text-xs py-1.5 border-b border-[var(--border)] last:border-0 flex items-center gap-2 ${
              t.status === 'completed' ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'
            }`}>
              <span className="text-amber-400">→</span> {t.title}
            </div>
          ))}
        </Card>
        <Card title={`AI Can Draft (${autoCount})`} accent="#AA66FF">
          {mkt.filter(t => t.is_automatable).map(t => (
            <div key={t.id} className={`text-xs py-1.5 border-b border-[var(--border)] last:border-0 flex items-center gap-2 ${
              t.status === 'completed' ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'
            }`}>
              <span className="text-purple-400">⚡</span> {t.title}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── Finance tab ──
function FinanceTab({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string, s: string) => void }) {
  const fin = tasks.filter(t => t.department === 'finance')
  const alertTasks = fin.filter(t => t.metric_threshold)
  const vendorTasks = fin.filter(t => t.vendor_name)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Current MRR" value="$0" sub="Pre-launch" />
        <StatCard label="Monthly Burn" value="~$14" sub="Render only" />
        <StatCard label="Break-Even" value="21" sub="subscribers needed" />
        <StatCard label="SaaS Margin" value=">80%" sub="target" />
      </div>

      <Card title="Revenue vs Costs Projection" accent="var(--primary)">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} />
            <YAxis tick={{ fill: '#8891A8', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => `$${v}`} />
            <Area type="monotone" dataKey="rev" stroke="var(--primary)" strokeWidth={2} fill="url(#revGrad2)" name="Revenue" />
            <Area type="monotone" dataKey="cost" stroke="#FF4444" strokeWidth={1.5} fill="none" name="Costs" strokeDasharray="5 5" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Cost Alerts & Thresholds" accent="#FFB800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Metric', 'Threshold', 'Current', 'Status', 'Note'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertTasks.map(t => (
                <tr key={t.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                  <td className="px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] border-b border-[var(--border)]">{t.title}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">{t.metric_threshold}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">{t.metric_current}</td>
                  <td className="px-3 py-2.5 border-b border-[var(--border)]">
                    <Badge text={t.alert_status === 'ok' ? 'OK' : t.alert_status === 'alert' ? 'ALERT' : 'WATCH'}
                      variant={t.alert_status === 'ok' ? 'green' : t.alert_status === 'alert' ? 'red' : 'amber'} />
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)] border-b border-[var(--border)]">{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Vendor Overview" accent="#22C55E">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Vendor', 'Service', 'Current Plan', 'Next Action'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorTasks.map(t => (
                <tr key={t.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                  <td className="px-3 py-2.5 text-sm font-semibold text-[var(--primary)] border-b border-[var(--border)]">{t.vendor_name}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-primary)] border-b border-[var(--border)]">{t.vendor_service}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">{t.vendor_plan}</td>
                  <td className="px-3 py-2.5 text-[11px] text-[var(--text-secondary)] border-b border-[var(--border)]">{t.vendor_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Market Research tab ──
function MarketResearchTab({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string, s: string) => void }) {
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

  const SOURCE_LABELS: Record<string, string> = {
    competitor_pricing: 'Competitor',
    product_hunt: 'Product Hunt',
    user_feedback: 'User Feedback',
    trend: 'Trend',
    usage_analysis: 'Usage',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Findings" value={findings.length} sub="all time" />
        <StatCard label="Pending Review" value={newFindings.length} sub="needs decision" alert={newFindings.length > 5 ? 'amber' : undefined} />
        <StatCard label="Accepted" value={acceptedFindings.length} sub="→ engineering backlog" />
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

      {/* Competitor comparison matrix placeholder */}
      <Card title="Competitor Feature Matrix" accent="#4488FF">
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
                { feature: 'Smart Calendar', us: false, fub: false, kv: true, struct: false, sierra: false },
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

// ── Main page ──
export default function AdminCommandCenter() {
  const router = useRouter()
  const [tab, setTab] = useState<typeof TABS[number]>('Overview')
  const [tasks, setTasks] = useState<Task[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0, completed: 0, blockers: 0, automatable: 0,
    byDepartment: { legal: 0, engineering: 0, marketing: 0, finance: 0, market_research: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Admin gate — check user ID
  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.profile?.id === ADMIN_USER_ID) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
          router.replace('/dashboard')
        }
      })
      .catch(() => { setIsAdmin(false); router.replace('/dashboard') })
  }, [router])

  // Fetch tasks
  const loadTasks = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await fetchTasks({ limit: 200 })
      if (res.ok) {
        setTasks(res.tasks)
        setSummary(res.summary)
        setLastUpdated(new Date())
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  // Fetch live system alerts
  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await fetch('/api/admin/alerts')
      const data = await res.json()
      if (data.ok) setAlerts(data.alerts)
    } catch { /* ignore */ }
    finally { setAlertsLoading(false) }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadTasks(true)
      loadAlerts()
      pollRef.current = setInterval(() => { loadTasks(false); loadAlerts() }, 30000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [isAdmin, loadTasks, loadAlerts])

  // Toggle task
  const handleToggle = useCallback(async (taskId: string, newStatus: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined, completed_by: newStatus === 'completed' ? 'user' : undefined }
        : t
    ))
    try {
      await patchTask(taskId, { status: newStatus, completed_by: newStatus === 'completed' ? 'user' : undefined })
      await loadTasks(false)
    } catch { loadTasks(false) }
  }, [loadTasks])

  // Loading / not admin
  if (isAdmin === null) {
    return <div className="flex items-center justify-center h-full"><div className="text-[var(--text-secondary)]">Loading...</div></div>
  }
  if (!isAdmin) return null

  const p0Count = tasks.filter(t => t.priority === 'P0' && t.status !== 'completed').length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length

  const renderTab = () => {
    if (loading) return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--surface)] border border-[var(--border)]" />)}
      </div>
    )
    const props = { tasks, onToggle: handleToggle, summary }
    switch (tab) {
      case 'Overview': return <OverviewTab {...props} alerts={alerts} />
      case 'Market Research': return <MarketResearchTab tasks={tasks} onToggle={handleToggle} />
      case 'Legal': return <DeptTab department="legal" tasks={tasks} onToggle={handleToggle} filters={['P0', 'P1', 'P2']} />
      case 'Engineering': return <EngineeringTab tasks={tasks} onToggle={handleToggle} alerts={alerts} alertsLoading={alertsLoading} />
      case 'Marketing': return <MarketingTab tasks={tasks} onToggle={handleToggle} />
      case 'Finance': return <FinanceTab tasks={tasks} onToggle={handleToggle} />
      default: return null
    }
  }

  return (
    <div className="min-h-full bg-[var(--background)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-sm bg-[var(--primary)]" style={{ boxShadow: '0 0 8px var(--primary)' }} />
                <h1 className="text-lg font-bold text-[var(--text-primary)]">Estate AI</h1>
                <span className="text-xs text-[var(--text-secondary)] border-l border-[var(--border)] pl-2.5">Command Center</span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)] mt-1 ml-[18px]">
                EYWA Consulting Services Inc — Pre-Launch
                {lastUpdated && <span className="ml-3">· Updated {lastUpdated.toLocaleTimeString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {p0Count > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                  </span>
                  <span className="text-xs font-semibold text-red-400">{p0Count} Blockers</span>
                </div>
              )}
              {criticalAlerts > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-xs font-semibold text-red-400">{criticalAlerts} System Alert{criticalAlerts > 1 ? 's' : ''}</span>
                </div>
              )}
              <button onClick={() => { loadTasks(true); loadAlerts() }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors cursor-pointer">
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-4">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all cursor-pointer ${
                tab === t
                  ? 'bg-[var(--background)] text-[var(--primary)] border border-[var(--border)] border-b-[var(--background)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
              }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 pb-12">
        {renderTab()}
      </div>
    </div>
  )
}
