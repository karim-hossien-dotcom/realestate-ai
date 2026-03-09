'use client'

import { useEffect, useState, useCallback } from 'react'

type DashboardData = {
  overview: {
    totalLeads: number
    messagesSent: number
    messagesReceived: number
    messagesFailed: number
    responseRate: number
    dncCount: number
    pendingFollowUps: number
  }
  leadsByScore: {
    Hot: number
    Warm: number
    Cold: number
    Dead: number
  }
  leadsByStatus: Array<{ status: string; count: number }>
  campaigns: {
    total: number
    totalSent: number
    totalFailed: number
    totalResponses: number
  }
  timeSeries: Array<{ date: string; sent: number; received: number }>
}

const TIME_RANGES = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(30)

  const fetchDashboard = useCallback(async (days: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/analytics/dashboard?days=${days}`)
      const result = await res.json()
      if (result.ok) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to load dashboard')
      }
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(timeRange)
  }, [timeRange, fetchDashboard])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-52 bg-[var(--surface-elevated)] rounded animate-pulse"></div>
            <div className="h-4 w-80 bg-[var(--surface-elevated)] rounded animate-pulse mt-2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[var(--surface)] rounded-lg p-4 animate-pulse">
              <div className="h-4 w-24 bg-[var(--surface-elevated)] rounded mb-2"></div>
              <div className="h-8 w-16 bg-[var(--surface-elevated)] rounded"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[var(--surface)] rounded-lg p-4 animate-pulse">
              <div className="h-4 w-24 bg-[var(--surface-elevated)] rounded mb-2"></div>
              <div className="h-8 w-16 bg-[var(--surface-elevated)] rounded"></div>
            </div>
          ))}
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-6 animate-pulse">
          <div className="h-5 w-40 bg-[var(--surface-elevated)] rounded mb-4"></div>
          <div className="h-32 bg-[var(--surface-elevated)] rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { overview, leadsByScore, campaigns, timeSeries } = data

  // Calculate max for bar chart scaling
  const maxBarValue = Math.max(
    ...timeSeries.map(d => Math.max(d.sent, d.received)),
    1
  )

  // Campaign delivery rate
  const deliveryRate = campaigns.totalSent > 0
    ? Math.round(((campaigns.totalSent - campaigns.totalFailed) / campaigns.totalSent) * 100)
    : 0
  const campaignResponseRate = campaigns.totalSent > 0
    ? Math.round((campaigns.totalResponses / campaigns.totalSent) * 100)
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Analytics Dashboard</h1>
          <p className="text-[var(--text-secondary)]">Overview of your lead management and outreach performance</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {TIME_RANGES.map(r => (
              <option key={r.value} value={r.value}>Last {r.label}</option>
            ))}
          </select>
          <button
            onClick={() => fetchDashboard(timeRange, true)}
            disabled={refreshing}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <i className={`fas fa-sync-alt ${refreshing ? 'animate-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Overview Cards - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={overview.totalLeads} icon="fa-users" color="blue" />
        <StatCard title="Messages Sent" value={overview.messagesSent} icon="fa-paper-plane" color="green" />
        <StatCard title="Responses" value={overview.messagesReceived} icon="fa-reply" color="purple" />
        <StatCard title="Response Rate" value={`${overview.responseRate}%`} icon="fa-chart-line" color="indigo" />
      </div>

      {/* Overview Cards - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Pending Follow-ups" value={overview.pendingFollowUps} icon="fa-clock" color="yellow" />
        <StatCard title="DNC List" value={overview.dncCount} icon="fa-ban" color="red" />
        <StatCard title="Failed Messages" value={overview.messagesFailed} icon="fa-exclamation-triangle" color="orange" />
      </div>

      {/* Lead Score Distribution with progress bars */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Lead Score Distribution</h2>
        <div className="space-y-4">
          <ScoreBar label="Hot" count={leadsByScore.Hot} total={overview.totalLeads} color="red" />
          <ScoreBar label="Warm" count={leadsByScore.Warm} total={overview.totalLeads} color="orange" />
          <ScoreBar label="Cold" count={leadsByScore.Cold} total={overview.totalLeads} color="blue" />
          <ScoreBar label="Dead" count={leadsByScore.Dead} total={overview.totalLeads} color="gray" />
        </div>
      </div>

      {/* Campaign Stats with rates */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Campaign Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
          <div>
            <div className="text-3xl font-bold text-[var(--text-primary)]">{campaigns.total}</div>
            <div className="text-sm text-[var(--text-secondary)]">Campaigns</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{campaigns.totalSent}</div>
            <div className="text-sm text-[var(--text-secondary)]">Delivered</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{campaigns.totalResponses}</div>
            <div className="text-sm text-[var(--text-secondary)]">Responses</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{campaigns.totalFailed}</div>
            <div className="text-sm text-[var(--text-secondary)]">Failed</div>
          </div>
        </div>
        {/* Rate summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[var(--text-secondary)]">Delivery Rate</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{deliveryRate}%</span>
            </div>
            <div className="w-full bg-[var(--surface-elevated)] rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${deliveryRate}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[var(--text-secondary)]">Response Rate</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{campaignResponseRate}%</span>
            </div>
            <div className="w-full bg-[var(--surface-elevated)] rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${campaignResponseRate}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Activity Bar Chart */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Message Activity
        </h2>
        {timeSeries.length > 0 ? (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span className="text-[var(--text-secondary)]">Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                <span className="text-[var(--text-secondary)]">Received</span>
              </div>
            </div>
            {/* Bar chart */}
            <div className="space-y-2">
              {timeSeries.slice(-14).map((day, i) => {
                const sentWidth = maxBarValue > 0 ? (day.sent / maxBarValue) * 100 : 0
                const recvWidth = maxBarValue > 0 ? (day.received / maxBarValue) * 100 : 0
                const dateLabel = new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-secondary)] w-14 text-right flex-shrink-0">{dateLabel}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="bg-blue-500 h-4 rounded-r transition-all"
                          style={{ width: `${Math.max(sentWidth, day.sent > 0 ? 2 : 0)}%` }}
                        ></div>
                        {day.sent > 0 && <span className="text-xs text-[var(--text-secondary)]">{day.sent}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="bg-purple-500 h-4 rounded-r transition-all"
                          style={{ width: `${Math.max(recvWidth, day.received > 0 ? 2 : 0)}%` }}
                        ></div>
                        {day.received > 0 && <span className="text-xs text-[var(--text-secondary)]">{day.received}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="text-[var(--text-secondary)] text-center py-8">
            No message activity yet. Start sending campaigns to see data here.
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: string
  color: string
}) {
  const colorClasses: Record<string, { bg: string; icon: string; darkBg: string; darkIcon: string }> = {
    blue:   { bg: 'bg-blue-100', icon: 'text-blue-600', darkBg: 'dark:bg-blue-500/15', darkIcon: 'dark:text-blue-300' },
    green:  { bg: 'bg-green-100', icon: 'text-green-600', darkBg: 'dark:bg-green-500/15', darkIcon: 'dark:text-green-300' },
    purple: { bg: 'bg-purple-100', icon: 'text-purple-600', darkBg: 'dark:bg-purple-500/15', darkIcon: 'dark:text-purple-300' },
    indigo: { bg: 'bg-indigo-100', icon: 'text-indigo-600', darkBg: 'dark:bg-indigo-500/15', darkIcon: 'dark:text-indigo-300' },
    yellow: { bg: 'bg-yellow-100', icon: 'text-yellow-600', darkBg: 'dark:bg-yellow-500/15', darkIcon: 'dark:text-yellow-300' },
    red:    { bg: 'bg-red-100', icon: 'text-red-600', darkBg: 'dark:bg-red-500/15', darkIcon: 'dark:text-red-300' },
    orange: { bg: 'bg-orange-100', icon: 'text-orange-600', darkBg: 'dark:bg-orange-500/15', darkIcon: 'dark:text-orange-300' },
  }

  const c = colorClasses[color] || colorClasses.blue

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${c.bg} ${c.darkBg}`}>
          <i className={`fas ${icon} ${c.icon} ${c.darkIcon}`}></i>
        </div>
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
  const barColors: Record<string, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-400',
  }
  const dotColors: Record<string, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-400',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColors[color]}`}></div>
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        </div>
        <span className="text-sm text-[var(--text-secondary)]">{count} ({percentage}%)</span>
      </div>
      <div className="w-full bg-[var(--surface-elevated)] rounded-full h-2.5">
        <div
          className={`${barColors[color]} h-2.5 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  )
}
