'use client'

import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, StatCard, Badge } from './AdminShared'
import type { Task, RevenueInfo } from './admin-types'

interface FinanceTabProps {
  tasks: Task[]
  onToggle: (id: string, status: string) => void
  revenue: RevenueInfo
}

export default function FinanceTab({ tasks, revenue }: FinanceTabProps) {
  const fin = tasks.filter(t => t.department === 'finance')
  const alertTasks = fin.filter(t => t.metric_threshold)
  const vendorTasks = fin.filter(t => t.vendor_name)

  const mrrLabel = revenue.currentMrr > 0 ? `$${revenue.currentMrr.toLocaleString()}` : '$0'
  const mrrSub = revenue.activeSubscribers > 0
    ? `${revenue.activeSubscribers} subscriber${revenue.activeSubscribers > 1 ? 's' : ''}`
    : 'Pre-launch'
  // Estimate monthly cost from latest data point
  const latestCost = revenue.revenueData.length > 0
    ? revenue.revenueData[revenue.revenueData.length - 1].cost
    : 14
  const marginPct = revenue.currentMrr > 0
    ? Math.round(((revenue.currentMrr - latestCost) / revenue.currentMrr) * 100)
    : 0
  // Break-even: how many $99 subs needed to cover costs
  const breakEvenSubs = Math.ceil(latestCost / 99)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Current MRR" value={mrrLabel} sub={mrrSub} />
        <StatCard label="Monthly Burn" value={`~$${latestCost}`} sub="estimated" />
        <StatCard label="Break-Even" value={String(breakEvenSubs)} sub="subscribers needed" />
        <StatCard label="SaaS Margin" value={revenue.currentMrr > 0 ? `${marginPct}%` : '>80%'} sub={revenue.currentMrr > 0 ? 'actual' : 'target'} />
      </div>

      <Card title="Revenue vs Costs (12-month)" accent="var(--primary)">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenue.revenueData}>
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
