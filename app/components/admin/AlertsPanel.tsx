'use client'

import { SEVERITY_STYLES, type SystemAlert } from './admin-types'
import { Card } from './AdminShared'

interface AlertsPanelProps {
  alerts: SystemAlert[]
  loading: boolean
}

export default function AlertsPanel({ alerts, loading }: AlertsPanelProps) {
  if (loading) {
    return (
      <Card title="System Health — Live" accent="#22C55E">
        <div className="flex items-center gap-2 py-4 justify-center text-[var(--text-secondary)] text-sm">
          <span className="animate-spin">{'\u21BB'}</span> Running health checks...
        </div>
      </Card>
    )
  }

  const critical = alerts.filter(a => a.severity === 'critical')
  const warnings = alerts.filter(a => a.severity === 'warning')
  const oks = alerts.filter(a => a.severity === 'ok')
  const sorted = [...critical, ...warnings, ...oks]

  return (
    <Card title={`System Health — Live (${critical.length > 0 ? '\u26A0 ' + critical.length + ' critical' : warnings.length > 0 ? warnings.length + ' warning' : 'All clear'})`}
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
