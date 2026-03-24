'use client'

import { Card, StatCard, DeptTab } from './AdminShared'
import { AgentBoardroom, BUSINESS_AGENTS, agentStyles } from './AgentCharacters'
import type { Task } from './admin-types'

interface MarketingTabProps {
  tasks: Task[]
  onToggle: (id: string, status: string) => void
}

export default function MarketingTab({ tasks, onToggle }: MarketingTabProps) {
  const mkt = tasks.filter(t => t.department === 'marketing')
  const autoCount = mkt.filter(t => t.is_automatable).length
  const manualCount = mkt.length - autoCount

  return (
    <div className="space-y-4">
      <style>{agentStyles}</style>
      <AgentBoardroom agents={BUSINESS_AGENTS.filter(a => a.name === 'Marketing')} teamColor="#D946EF" teamName="Marketing" />
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Website Target" value="5K" sub="visitors in 90 days" />
        <StatCard label="Signup Conv." value="3-5%" sub="visitor \u2192 trial" />
        <StatCard label="CAC Target" value="<$150" sub="per customer" />
        <StatCard label="Trial \u2192 Paid" value="20%+" sub="conversion rate" />
      </div>
      <DeptTab department="marketing" tasks={tasks} onToggle={onToggle} filters={['P1', 'P2', 'auto']} />
      <div className="grid grid-cols-2 gap-4">
        <Card title={`Needs You (${manualCount})`} accent="#FFB800">
          {mkt.filter(t => !t.is_automatable).map(t => (
            <div key={t.id} className={`text-xs py-1.5 border-b border-[var(--border)] last:border-0 flex items-center gap-2 ${
              t.status === 'completed' ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'
            }`}>
              <span className="text-amber-400">{'\u2192'}</span> {t.title}
            </div>
          ))}
        </Card>
        <Card title={`AI Can Draft (${autoCount})`} accent="#AA66FF">
          {mkt.filter(t => t.is_automatable).map(t => (
            <div key={t.id} className={`text-xs py-1.5 border-b border-[var(--border)] last:border-0 flex items-center gap-2 ${
              t.status === 'completed' ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'
            }`}>
              <span className="text-purple-400">{'\u26A1'}</span> {t.title}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
