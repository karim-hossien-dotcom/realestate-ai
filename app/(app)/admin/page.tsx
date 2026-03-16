'use client'

// Purpose: Owner-only command center — track tasks, costs, launch readiness
// Tone: Dark terminal / ops dashboard
// Reference: Antimetal.com, Linear
// Differentiator: Live Supabase-connected task tracker with department breakdown + financial alerts

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import OverviewTab from '@/app/components/admin/OverviewTab'
import EngineeringTab from '@/app/components/admin/EngineeringTab'
import MarketingTab from '@/app/components/admin/MarketingTab'
import FinanceTab from '@/app/components/admin/FinanceTab'
import MarketResearchTab from '@/app/components/admin/MarketResearchTab'
import { DeptTab } from '@/app/components/admin/AdminShared'
import {
  EMPTY_REVENUE, fetchTasks, patchTask,
  type Task, type Summary, type SystemAlert, type RevenueInfo,
} from '@/app/components/admin/admin-types'

// Owner user ID — only this account can access /admin
const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''

const TABS = ['Overview', 'Market Research', 'Legal', 'Engineering', 'Marketing', 'Finance'] as const

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
  const [revenue, setRevenue] = useState<RevenueInfo>(EMPTY_REVENUE)
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

  // Fetch revenue data from subscriptions
  const loadRevenue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/revenue')
      const data = await res.json()
      if (data.ok) {
        setRevenue({
          revenueData: data.revenueData,
          currentMrr: data.currentMrr,
          activeSubscribers: data.activeSubscribers,
          planCounts: data.planCounts,
        })
      }
    } catch (err) { console.error('[Admin] Failed to load revenue:', err) }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadTasks(true)
      loadAlerts()
      loadRevenue()
      pollRef.current = setInterval(() => { loadTasks(false); loadAlerts(); loadRevenue() }, 30000)
      return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }
  }, [isAdmin, loadTasks, loadAlerts, loadRevenue])

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
    switch (tab) {
      case 'Overview': return <OverviewTab tasks={tasks} onToggle={handleToggle} summary={summary} alerts={alerts} revenue={revenue} />
      case 'Market Research': return <MarketResearchTab tasks={tasks} onToggle={handleToggle} />
      case 'Legal': return <DeptTab department="legal" tasks={tasks} onToggle={handleToggle} filters={['P0', 'P1', 'P2']} />
      case 'Engineering': return <EngineeringTab tasks={tasks} onToggle={handleToggle} alerts={alerts} alertsLoading={alertsLoading} />
      case 'Marketing': return <MarketingTab tasks={tasks} onToggle={handleToggle} />
      case 'Finance': return <FinanceTab tasks={tasks} onToggle={handleToggle} revenue={revenue} />
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
                EYWA Consulting Services Inc {'\u2014'} Pre-Launch
                {lastUpdated && <span className="ml-3">{'\u00B7'} Updated {lastUpdated.toLocaleTimeString()}</span>}
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
              <button onClick={() => { loadTasks(true); loadAlerts(); loadRevenue() }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors cursor-pointer">
                {'\u21BB'} Refresh
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
