'use client'

import AlertsPanel from './AlertsPanel'
import AiAuditPanel from './AiAuditPanel'
import AiImprovementPanel from './AiImprovementPanel'
import { Card, DeptTab } from './AdminShared'
import type { Task, SystemAlert } from './admin-types'

interface EngineeringTabProps {
  tasks: Task[]
  onToggle: (id: string, status: string) => void
  alerts: SystemAlert[]
  alertsLoading: boolean
}

export default function EngineeringTab({ tasks, onToggle, alerts, alertsLoading }: EngineeringTabProps) {
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
        <Card title="Codebase" accent="var(--primary)">
          <div className="text-center py-2">
            <div className="text-5xl font-bold text-[var(--primary)]">54</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">API Routes {'\u00B7'} 18 Tables {'\u00B7'} 3 Channels</div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-[var(--text-secondary)]">Test Coverage</span>
              <span className="text-[11px] text-emerald-400">197 tests / 8 files</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-elevated)]">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400" style={{ width: '65%' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* AI Conversation Quality Audit */}
      <AiAuditPanel />

      {/* AI Improvement Proposals — review and accept/reject */}
      <Card title="AI Agent Improvements" accent="#A855F7">
        <AiImprovementPanel />
      </Card>

      <DeptTab department="engineering" tasks={tasks} onToggle={onToggle} filters={['P0', 'P1', 'P2', 'P3', 'auto']} />
    </div>
  )
}
