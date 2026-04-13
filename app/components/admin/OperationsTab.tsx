'use client'

import { useState } from 'react'
import { Card, StatCard } from './AdminShared'

// ── Org Chart Data ──
// Reflects the actual 16-agent structure with schedule frequencies
const ORG = {
  ceo: { name: 'Karim Hossien', title: 'CEO — EYWA Consulting', color: '#F59E0B' },
  ai: { name: 'Claude Opus 4.6', title: 'AI CTO — Orchestrates all agents', color: '#3B82F6' },
  departments: [
    {
      name: 'Engineering',
      color: '#3B82F6',
      agents: [
        { name: 'Eng Ops', type: 'daily', schedule: 'Daily' },
        { name: 'Delivery Monitor', type: '30min', schedule: 'Every 30 min' },
        { name: 'Planner', type: 'on-demand' },
        { name: 'Architect', type: 'on-demand' },
        { name: 'TDD Guide', type: 'on-demand' },
        { name: 'Code Reviewer', type: 'on-demand' },
        { name: 'Build Resolver', type: 'on-demand' },
        { name: 'Refactor Cleaner', type: 'monthly', schedule: 'Monthly (15th)' },
        { name: 'E2E Runner', type: 'weekly', schedule: 'Weekly (Sat)' },
        { name: 'Doc Updater', type: 'on-demand' },
      ],
    },
    {
      name: 'Security',
      color: '#EF4444',
      agents: [
        { name: 'Security Reviewer', type: 'weekly', schedule: 'Weekly (Fri)' },
      ],
    },
    {
      name: 'AI Quality',
      color: '#0EA5E9',
      agents: [
        { name: 'AI Improver', type: 'weekly', schedule: 'Weekly (Sun)' },
      ],
    },
    {
      name: 'Finance',
      color: '#22C55E',
      agents: [
        { name: 'Finance Ops', type: 'weekly', schedule: 'Weekly (Mon)' },
      ],
    },
    {
      name: 'Legal',
      color: '#F59E0B',
      agents: [
        { name: 'Legal Ops', type: 'monthly', schedule: 'Monthly (1st)' },
      ],
    },
    {
      name: 'Marketing',
      color: '#A855F7',
      agents: [
        { name: 'Marketing Ops', type: 'weekly', schedule: 'Weekly (Wed)' },
      ],
    },
    {
      name: 'Research',
      color: '#EC4899',
      agents: [
        { name: 'Market Research', type: 'biweekly', schedule: 'Biweekly (1st & 15th)' },
      ],
    },
  ],
}

// Schedule type badge styling
function scheduleStyle(type: string): { bg: string; text: string; label: string } {
  switch (type) {
    case '30min': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '30m' }
    case 'daily': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Daily' }
    case 'weekly': return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Weekly' }
    case 'biweekly': return { bg: 'bg-purple-500/10', text: 'text-purple-400', label: '2-Week' }
    case 'monthly': return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Monthly' }
    default: return { bg: 'bg-[var(--surface-elevated)]', text: 'text-[var(--text-secondary)]', label: 'On-demand' }
  }
}

// Helper to calculate next run time
function getNextRun(schedule: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  if (schedule.startsWith('Every')) {
    const mins = parseInt(schedule.match(/\d+/)?.[0] || '5')
    const next = new Date(now.getTime() + mins * 60 * 1000)
    return `${pad(next.getHours())}:${pad(next.getMinutes())}`
  }
  if (schedule.includes('Daily')) {
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    next.setHours(0, 0, 0, 0)
    return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (schedule.includes('Weekly')) {
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }
    const dayName = schedule.match(/\((\w+)\)/)?.[1] || 'Monday'
    const targetDay = dayMap[dayName] ?? 1
    const next = new Date(now)
    const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7
    next.setDate(now.getDate() + daysUntil)
    return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (schedule.includes('Biweekly')) {
    const day = now.getDate()
    const next = day < 15
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (schedule.includes('Monthly')) {
    const dayMatch = schedule.match(/(\d+)\w{0,2}\)/)
    const targetDay = dayMatch ? parseInt(dayMatch[1]) : 1
    const next = now.getDate() >= targetDay
      ? new Date(now.getFullYear(), now.getMonth() + 1, targetDay)
      : new Date(now.getFullYear(), now.getMonth(), targetDay)
    return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return '—'
}

// Cron jobs (infrastructure-level automation)
const CRON_SCHEDULES = [
  { name: 'send-followups', frequency: 'Every 5 min', desc: 'Send scheduled follow-up messages', agent: 'Eng Ops' },
  { name: 'check-alerts', frequency: 'Every 30 min', desc: 'Monitor services + email on critical', agent: 'Eng Ops' },
  { name: 'delivery-monitor', frequency: 'Every 30 min', desc: 'Verify WhatsApp/SMS delivery statuses', agent: 'Delivery Monitor' },
  { name: 'daily-ops', frequency: 'Daily (midnight)', desc: 'System health checks + daily reports + auto-create tasks', agent: 'Eng Ops' },
  { name: 'refresh-lead-scores', frequency: 'Daily (3am)', desc: 'Recalculate all lead scores — time decay + activity', agent: 'Eng Ops' },
  { name: 'weekly-ai-audit', frequency: 'Weekly (Sunday)', desc: 'AI conversation quality + ops health metrics', agent: 'AI Improver' },
  { name: 'ai-improvement-report', frequency: 'Weekly (Sunday)', desc: 'Analyze low-scoring convos, propose AI prompt improvements', agent: 'AI Improver' },
  { name: 'stale-lead-detection', frequency: 'Weekly (Monday)', desc: 'Flag stale hot/warm leads, auto-create follow-ups', agent: 'Eng Ops' },
  { name: 'competitor-pricing', frequency: 'Biweekly (1st & 15th)', desc: 'Competitor pricing + capabilities + research findings', agent: 'Market Research' },
  { name: 'cost-report', frequency: 'Monthly (1st)', desc: 'MRR, message volume, cost breakdown, margins', agent: 'Finance Ops' },
]

// Agent schedules (intelligence-level automation)
const AGENT_SCHEDULES = [
  { name: 'Engineering Ops', frequency: 'Daily', desc: 'Health checks, error scans, delivery rates, test suite', dept: 'Engineering', color: '#3B82F6' },
  { name: 'Finance Ops', frequency: 'Weekly (Mon)', desc: 'Cost tracking, revenue monitoring, vendor management', dept: 'Finance', color: '#22C55E' },
  { name: 'Marketing Ops', frequency: 'Weekly (Wed)', desc: 'Content calendar, campaign performance, landing page audit', dept: 'Marketing', color: '#A855F7' },
  { name: 'Security Reviewer', frequency: 'Weekly (Fri)', desc: 'Vulnerability scan, auth audit, secrets check', dept: 'Security', color: '#EF4444' },
  { name: 'E2E Runner', frequency: 'Weekly (Sat)', desc: 'Critical user flow regression tests', dept: 'Engineering', color: '#3B82F6' },
  { name: 'AI Improver', frequency: 'Weekly (Sun)', desc: 'Conversation quality analysis, prompt improvement proposals', dept: 'AI Quality', color: '#0EA5E9' },
  { name: 'Market Research', frequency: 'Biweekly (1st & 15th)', desc: 'Pricing, capabilities, feature gaps, trend tracking', dept: 'Research', color: '#EC4899' },
  { name: 'Legal Ops', frequency: 'Monthly (1st)', desc: 'TCPA/CAN-SPAM/CCPA compliance, DNC enforcement', dept: 'Legal', color: '#F59E0B' },
  { name: 'Refactor Cleaner', frequency: 'Monthly (15th)', desc: 'Dead code audit, oversized file split, dependency cleanup', dept: 'Engineering', color: '#3B82F6' },
]

const MANUAL_TASKS: Array<{ name: string; deadline?: string; frequency: string; desc: string; priority: string }> = [
  { name: '10DLC follow-up', frequency: 'Weekly (check)', desc: 'Check Twilio 10DLC registration status — resubmitted Mar 23', priority: 'P0' },
  { name: 'UX review', frequency: 'Monthly (1st)', desc: 'Full UX checklist — core flows, mobile, dark mode', priority: 'P2' },
  { name: 'E&O insurance', frequency: 'One-time', desc: 'Get quotes and activate professional liability insurance', priority: 'P1' },
  { name: 'Nadine lead dedup', frequency: 'One-time', desc: 'Mina Aziz and Boris Fidelman appear twice — need manual dedup', priority: 'P1' },
]

const SKILLS = [
  { name: 'Superpowers', count: 7, items: ['Brainstorming', 'Plans', 'TDD', 'Debugging', 'Code Review', 'Verification', 'Parallel Agents'] },
  { name: 'Document Skills', count: 6, items: ['PDF', 'PPTX', 'XLSX', 'DOCX', 'Frontend', 'MCP Builder'] },
  { name: 'Planning', count: 3, items: ['File-Based Planning', 'Task Plans', 'Progress Tracking'] },
  { name: 'UI/UX Pro Max', count: 5, items: ['67 Styles', '96 Palettes', '57 Fonts', '13 Stacks', 'Design Systems'] },
]

const INFRA = [
  { label: 'Node.js Service', value: 'Render (free)', status: 'live' },
  { label: 'Python Webhook', value: 'Render (starter)', status: 'live' },
  { label: 'Database', value: 'Supabase (24 tables)', status: 'live' },
  { label: 'AI Model', value: 'GPT-4o', status: 'live' },
  { label: 'Domain', value: 'realestate-ai.app', status: 'live' },
  { label: 'WhatsApp', value: 'Meta Business API v21.0', status: 'live' },
  { label: 'SMS', value: 'Twilio (10DLC pending)', status: 'pending' },
  { label: 'Email', value: 'Resend', status: 'live' },
  { label: 'Payments', value: 'Stripe (3 tiers)', status: 'live' },
  { label: 'Monthly Burn', value: '~$25.54', status: 'info' },
]

const MCPS = [
  { name: 'Supabase', status: 'connected', desc: '24 tables, RLS, PostgREST' },
  { name: 'Sentry', status: 'disconnected', desc: 'Error tracking (not configured)' },
]

export default function OperationsTab() {
  const totalAgents = ORG.departments.reduce((s, d) => s + d.agents.length, 0)
  const scheduledAgents = ORG.departments.reduce((s, d) => s + d.agents.filter(a => a.type !== 'on-demand').length, 0)
  const onDemandAgents = totalAgents - scheduledAgents

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={totalAgents} sub={`${scheduledAgents} scheduled, ${onDemandAgents} on-demand`} />
        <StatCard label="Cron Jobs" value={CRON_SCHEDULES.length} sub="infrastructure automation" />
        <StatCard label="Services" value={INFRA.filter(i => i.status === 'live').length} sub="operational" />
        <StatCard label="Departments" value={ORG.departments.length} sub={`${SKILLS.reduce((s, sk) => s + sk.count, 0)} skills loaded`} />
      </div>

      {/* Org Chart */}
      <Card title="Organization Chart — 16 Agents, 7 Departments" accent="var(--primary)">
        <div className="space-y-4 py-2">
          {/* CEO */}
          <div className="flex justify-center">
            <div className="px-5 py-3 rounded-xl border-2 text-center" style={{ borderColor: ORG.ceo.color, background: `${ORG.ceo.color}10` }}>
              <p className="text-sm font-bold text-[var(--text-primary)]">{ORG.ceo.name}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{ORG.ceo.title}</p>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-[var(--border)]" /></div>

          {/* AI CTO */}
          <div className="flex justify-center">
            <div className="px-5 py-3 rounded-xl border-2 text-center" style={{ borderColor: ORG.ai.color, background: `${ORG.ai.color}10` }}>
              <p className="text-sm font-bold" style={{ color: ORG.ai.color }}>{ORG.ai.name}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{ORG.ai.title}</p>
            </div>
          </div>
          <div className="flex justify-center"><div className="w-px h-5 bg-[var(--border)]" /></div>

          {/* Connector line */}
          <div className="flex justify-center">
            <div className="w-[90%] h-px bg-[var(--border)]" />
          </div>

          {/* Departments — 2 rows for 7 depts */}
          <div className="grid grid-cols-4 gap-3">
            {ORG.departments.map(dept => (
              <div key={dept.name} className="rounded-xl border p-3" style={{ borderColor: `${dept.color}30` }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: dept.color }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: dept.color }}>{dept.name}</span>
                  <span className="text-[9px] text-[var(--text-secondary)] ml-auto">{dept.agents.length}</span>
                </div>
                <div className="space-y-1">
                  {dept.agents.map(agent => {
                    const style = scheduleStyle(agent.type)
                    return (
                      <div key={agent.name} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-[var(--text-primary)] text-[11px]">{agent.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Agent Schedules — the intelligence layer */}
      <Card title={`Agent Schedules — ${AGENT_SCHEDULES.length} Automated`} accent="#0EA5E9">
        <div className="space-y-0">
          {AGENT_SCHEDULES.map(agent => (
            <div key={agent.name} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full" style={{ background: agent.color }} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{agent.name}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-secondary)]">{agent.dept}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)]">{agent.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-[var(--text-primary)]">{agent.frequency}</span>
                <p className="text-[9px] text-blue-400">Next: {getNextRun(agent.frequency)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cron Jobs — the infrastructure layer */}
      <Card title={`Cron Jobs — ${CRON_SCHEDULES.length} Active`} accent="#22C55E">
        <div className="space-y-0">
          {CRON_SCHEDULES.map(cron => (
            <div key={cron.name} className="flex items-center justify-between py-2.5 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-[13px] font-medium text-[var(--text-primary)]">{cron.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{cron.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-[var(--text-primary)]">{cron.frequency}</span>
                <p className="text-[9px] text-emerald-400">Next: {getNextRun(cron.frequency)}</p>
                <p className="text-[9px] text-[var(--text-secondary)]">{cron.agent}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Manual Recurring Tasks */}
      <Card title="Manual / Recurring Tasks" accent="#F59E0B">
        <div className="space-y-0">
          {MANUAL_TASKS.map(task => {
            const isOverdue = task.deadline && new Date(task.deadline) < new Date()
            const daysLeft = task.deadline
              ? Math.ceil((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null
            return (
              <div key={task.name} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    task.priority === 'P0' ? 'bg-red-500/10 text-red-400'
                    : task.priority === 'P1' ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
                  }`}>{task.priority}</span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{task.name}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{task.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[var(--text-secondary)]">{task.frequency}</span>
                  {task.deadline && (
                    <p className={`text-[9px] font-medium ${isOverdue ? 'text-red-400' : daysLeft !== null && daysLeft <= 7 ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`}>
                      {isOverdue ? 'OVERDUE' : `${daysLeft}d left`} — {task.deadline}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Infrastructure */}
        <Card title="Infrastructure" accent="var(--primary)">
          <div className="space-y-0">
            {INFRA.map(item => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-primary)]">{item.value}</span>
                  {item.status === 'live' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  {item.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Skills + MCP */}
        <div className="space-y-4">
          <Card title="Skill Packs" accent="#A855F7">
            <div className="space-y-3">
              {SKILLS.map(sk => (
                <div key={sk.name}>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">{sk.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {sk.items.map(item => (
                      <span key={item} className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="MCP Servers" accent="#0EA5E9">
            {MCPS.map(mcp => (
              <div key={mcp.name} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{mcp.name}</p>
                  <p className="text-[9px] text-[var(--text-secondary)]">{mcp.desc}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${mcp.status === 'connected' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <span className={`text-[9px] ${mcp.status === 'connected' ? 'text-emerald-400' : 'text-[var(--text-secondary)]'}`}>{mcp.status}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
