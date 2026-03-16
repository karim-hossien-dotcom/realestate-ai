// Shared types and constants for admin components

export interface Task {
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

export interface Summary {
  total: number
  completed: number
  blockers: number
  automatable: number
  byDepartment: {
    legal: number
    engineering: number
    marketing: number
    finance: number
    market_research: number
  }
}

export interface SystemAlert {
  key: string
  category: string
  severity: 'ok' | 'warning' | 'critical'
  title: string
  message: string
  metricValue: string
  threshold: string
}

export interface ResearchFinding {
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

export interface RevenueDataPoint {
  name: string
  rev: number
  cost: number
}

export interface RevenueInfo {
  revenueData: RevenueDataPoint[]
  currentMrr: number
  activeSubscribers: number
  planCounts: Record<string, number>
}

export interface DailyDigest {
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

// Fallback empty revenue data (12 months of zeros)
export const EMPTY_REVENUE: RevenueInfo = {
  revenueData: Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 11 + i, 1)
    return { name: d.toLocaleString('en-US', { month: 'short' }), rev: 0, cost: 14 }
  }),
  currentMrr: 0,
  activeSubscribers: 0,
  planCounts: {},
}

export const DEPT_COLORS: Record<string, string> = {
  legal: '#FF4444',
  engineering: '#22C55E',
  marketing: '#4488FF',
  finance: '#FFB800',
  market_research: '#AA66FF',
}

export const HEALTH_DOT: Record<string, { color: string; label: string }> = {
  green: { color: '#22C55E', label: 'Healthy' },
  yellow: { color: '#FFB800', label: 'Warning' },
  red: { color: '#FF4444', label: 'Critical' },
  gray: { color: '#6B7280', label: 'No Report' },
}

export const BADGE_STYLES: Record<string, string> = {
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  lime: 'bg-lime-400/10 text-lime-400 border-lime-400/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  default: 'bg-[var(--badge-muted-bg)] text-[var(--text-secondary)] border-[var(--border)]',
}

export const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  critical: { border: 'border-red-500/30', bg: 'bg-red-500/5', icon: '🔴', text: 'text-red-400' },
  warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: '🟡', text: 'text-amber-400' },
  ok: { border: 'border-emerald-500/20', bg: 'bg-transparent', icon: '🟢', text: 'text-emerald-400' },
}

// API helpers
export async function fetchTasks(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) query.set(k, String(v))
  })
  const res = await fetch(`/api/tasks?${query.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

export async function patchTask(id: string, updates: Record<string, unknown>) {
  const res = await fetch('/api/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}
