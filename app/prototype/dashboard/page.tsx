'use client'

import { useEffect, useState } from 'react'

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/dashboard')
      .then(res => res.json())
      .then(result => {
        if (result.ok) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load dashboard')
        }
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { overview, leadsByScore, campaigns, timeSeries } = data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <span className="text-sm text-gray-500">Last 30 days</span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={overview.totalLeads}
          icon="fa-users"
          color="blue"
        />
        <StatCard
          title="Messages Sent"
          value={overview.messagesSent}
          icon="fa-paper-plane"
          color="green"
        />
        <StatCard
          title="Responses"
          value={overview.messagesReceived}
          icon="fa-reply"
          color="purple"
        />
        <StatCard
          title="Response Rate"
          value={`${overview.responseRate}%`}
          icon="fa-chart-line"
          color="indigo"
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Pending Follow-ups"
          value={overview.pendingFollowUps}
          icon="fa-clock"
          color="yellow"
        />
        <StatCard
          title="DNC List"
          value={overview.dncCount}
          icon="fa-ban"
          color="red"
        />
        <StatCard
          title="Failed Messages"
          value={overview.messagesFailed}
          icon="fa-exclamation-triangle"
          color="orange"
        />
      </div>

      {/* Lead Score Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Score Distribution</h2>
        <div className="grid grid-cols-4 gap-4">
          <ScoreCard label="Hot" count={leadsByScore.Hot} total={overview.totalLeads} color="red" />
          <ScoreCard label="Warm" count={leadsByScore.Warm} total={overview.totalLeads} color="orange" />
          <ScoreCard label="Cold" count={leadsByScore.Cold} total={overview.totalLeads} color="blue" />
          <ScoreCard label="Dead" count={leadsByScore.Dead} total={overview.totalLeads} color="gray" />
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold text-gray-900">{campaigns.total}</div>
            <div className="text-sm text-gray-500">Campaigns</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600">{campaigns.totalSent}</div>
            <div className="text-sm text-gray-500">Delivered</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-purple-600">{campaigns.totalResponses}</div>
            <div className="text-sm text-gray-500">Responses</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-600">{campaigns.totalFailed}</div>
            <div className="text-sm text-gray-500">Failed</div>
          </div>
        </div>
      </div>

      {/* Message Activity Chart (Simple) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Activity (Last 14 Days)</h2>
        {timeSeries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500">Date</th>
                  <th className="text-right py-2 text-gray-500">Sent</th>
                  <th className="text-right py-2 text-gray-500">Received</th>
                </tr>
              </thead>
              <tbody>
                {timeSeries.slice(-7).map((day, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                    <td className="text-right py-2 text-green-600">{day.sent}</td>
                    <td className="text-right py-2 text-purple-600">{day.received}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-8">
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
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <i className={`fas ${icon}`}></i>
        </div>
      </div>
    </div>
  )
}

function ScoreCard({
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
  const colorClasses: Record<string, string> = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    gray: 'bg-gray-400',
  }

  return (
    <div className="text-center">
      <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl ${colorClasses[color]}`}>
        {count}
      </div>
      <div className="mt-2 font-medium text-gray-900">{label}</div>
      <div className="text-sm text-gray-500">{percentage}%</div>
    </div>
  )
}
