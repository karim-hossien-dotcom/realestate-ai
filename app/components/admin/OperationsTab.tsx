'use client'

import { Card, StatCard } from './AdminShared'

const CRON_SCHEDULES = [
  { name: 'send-followups', frequency: 'Every 5 min', endpoint: '/api/cron/send-followups', desc: 'Send scheduled follow-up messages', status: 'active' },
  { name: 'daily-ops', frequency: 'Daily (midnight)', endpoint: '/api/cron/daily-ops', desc: 'System health checks + daily reports', status: 'active' },
  { name: 'check-alerts', frequency: 'Every 15 min', endpoint: '/api/cron/check-alerts', desc: 'Monitor services + email on critical', status: 'active' },
  { name: 'weekly-ai-audit', frequency: 'Weekly (Sunday)', endpoint: '/api/cron/weekly-ai-audit', desc: 'AI quality scoring + ops health check', status: 'active' },
  { name: 'UX review', frequency: 'Monthly (1st)', endpoint: 'Manual', desc: 'Full UX checklist — core flows, mobile, dark mode', status: 'manual' },
]

const SKILLS = [
  { name: 'Superpowers', count: 7, items: ['Brainstorming', 'Plans', 'TDD', 'Debugging', 'Code Review', 'Verification', 'Parallel Agents'] },
  { name: 'Document Skills', count: 6, items: ['PDF', 'PPTX', 'XLSX', 'DOCX', 'Frontend', 'MCP Builder'] },
  { name: 'Planning', count: 3, items: ['File-Based Planning', 'Task Plans', 'Progress Tracking'] },
  { name: 'UI/UX Pro Max', count: 5, items: ['67 Styles', '96 Palettes', '57 Fonts', '13 Stacks', 'Design Systems'] },
]

const INFRA = [
  { label: 'Node.js Service', value: 'Render (free tier)', status: 'live' },
  { label: 'Python Webhook', value: 'Render (starter)', status: 'live' },
  { label: 'Database', value: 'Supabase (free tier)', status: 'live' },
  { label: 'AI Model', value: 'GPT-4o', status: 'live' },
  { label: 'Domain', value: 'realestate-ai.app', status: 'live' },
  { label: 'WhatsApp', value: 'Meta Business API v21.0', status: 'live' },
  { label: 'SMS', value: 'Twilio (10DLC pending)', status: 'pending' },
  { label: 'Email', value: 'Resend', status: 'live' },
  { label: 'Payments', value: 'Stripe (3 tiers)', status: 'live' },
  { label: 'Monthly Burn', value: '$25.54', status: 'info' },
]

const MCPS = [
  { name: 'Supabase', status: 'connected', desc: '18+ tables, RLS, PostgREST API' },
  { name: 'Sentry', status: 'disconnected', desc: 'Error tracking (not configured)' },
]

export default function OperationsTab() {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Cron Jobs" value={CRON_SCHEDULES.filter(c => c.status === 'active').length} sub={`${CRON_SCHEDULES.length} total`} />
        <StatCard label="Skill Packs" value={SKILLS.length} sub={`${SKILLS.reduce((s, sk) => s + sk.count, 0)} skills total`} />
        <StatCard label="Services" value={INFRA.filter(i => i.status === 'live').length} sub="All operational" />
        <StatCard label="MCP Servers" value={MCPS.filter(m => m.status === 'connected').length} sub={`${MCPS.length} configured`} />
      </div>

      {/* Cron Schedules */}
      <Card title="Automated Schedules" accent="#22C55E">
        <div className="space-y-0">
          {CRON_SCHEDULES.map(cron => (
            <div key={cron.name} className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${cron.status === 'active' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{cron.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">{cron.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-[var(--text-primary)]">{cron.frequency}</span>
                <p className="text-[9px] text-[var(--text-secondary)] font-mono">{cron.endpoint}</p>
              </div>
            </div>
          ))}
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
                  <span className={`text-[9px] ${mcp.status === 'connected' ? 'text-emerald-400' : 'text-white/30'}`}>{mcp.status}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
