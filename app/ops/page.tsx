'use client';

import { useState } from 'react';

// ── Agent Data ──
const DEPARTMENTS = [
  {
    name: 'Engineering',
    color: '#3b82f6',
    icon: '⚡',
    agents: [
      { name: 'Architect', role: 'System design & structural decisions', status: 'idle', avatar: '🏗️', skills: ['System Design', 'Database Schema', 'API Architecture'] },
      { name: 'Planner', role: 'Break features into phased, actionable steps', status: 'idle', avatar: '📋', skills: ['Task Decomposition', 'Dependency Mapping', 'Estimation'] },
      { name: 'TDD Guide', role: 'Tests first, implementation second', status: 'idle', avatar: '🧪', skills: ['Vitest', 'Unit Tests', 'Integration Tests'] },
      { name: 'Code Reviewer', role: 'Review for correctness, security, perf', status: 'idle', avatar: '🔍', skills: ['Code Quality', 'Security', 'Performance'] },
      { name: 'Build Error Resolver', role: 'Diagnose & fix build failures', status: 'idle', avatar: '🔧', skills: ['TypeScript', 'Next.js', 'Debugging'] },
      { name: 'Refactor Cleaner', role: 'Remove dead code & reduce complexity', status: 'idle', avatar: '🧹', skills: ['Dead Code', 'Unused Imports', 'Simplification'] },
      { name: 'E2E Runner', role: 'End-to-end test critical flows', status: 'idle', avatar: '🎯', skills: ['Playwright', 'User Flows', 'Regression'] },
      { name: 'Doc Updater', role: 'Keep docs in sync with code', status: 'idle', avatar: '📝', skills: ['CLAUDE.md', 'API Docs', 'PLAN.md'] },
      { name: 'Engineering Ops', role: 'App health, feature delivery, code quality', status: 'active', avatar: '📊', skills: ['Monitoring', 'Deploys', 'CI/CD'] },
    ],
  },
  {
    name: 'Security',
    color: '#ef4444',
    icon: '🛡️',
    agents: [
      { name: 'Security Reviewer', role: 'Audit code for vulnerabilities. Think like an attacker.', status: 'active', avatar: '🔐', skills: ['OWASP Top 10', 'Rate Limiting', 'Secrets Scan', 'Input Sanitization', 'CSP'] },
    ],
  },
  {
    name: 'Business Ops',
    color: '#a855f7',
    icon: '💼',
    agents: [
      { name: 'Finance Ops', role: 'Cost tracking, revenue, vendor management', status: 'idle', avatar: '💰', skills: ['Burn Rate', 'Margins', 'Unit Economics'] },
      { name: 'Legal Ops', role: 'Compliance, policy, regulatory tracking', status: 'idle', avatar: '⚖️', skills: ['TCPA', 'CCPA', 'GDPR', 'DNC', '10DLC'] },
      { name: 'Marketing Ops', role: 'Content strategy, campaigns, landing pages', status: 'active', avatar: '📣', skills: ['LinkedIn', 'Ad Creatives', 'Email Outreach', 'Landing Pages'] },
      { name: 'Market Research', role: 'Competitive intel, trends, gap analysis', status: 'idle', avatar: '🔬', skills: ['Competitor Analysis', 'Sentiment', 'Pricing', 'Trends'] },
    ],
  },
];

const SKILLS = [
  { name: 'Superpowers', items: ['Brainstorming', 'Writing Plans', 'TDD', 'Debugging', 'Code Review', 'Verification', 'Parallel Agents'] },
  { name: 'Document Skills', items: ['PDF', 'PPTX', 'XLSX', 'DOCX', 'Frontend Design', 'MCP Builder'] },
  { name: 'Planning', items: ['File-Based Planning', 'Task Plans', 'Progress Tracking'] },
  { name: 'UI/UX Pro Max', items: ['67 Styles', '96 Palettes', '57 Font Pairings', '13 Stacks', 'Design Systems'] },
];

const MCPS = [
  { name: 'Supabase', status: 'connected', desc: '18 tables, RLS, PostgREST' },
  { name: 'Sentry', status: 'disconnected', desc: 'Error tracking (not configured)' },
];

const PROJECTS = [
  { name: 'Estate AI', path: '~/Desktop/realestate-ai', stack: 'Next.js 16 + Supabase + Python', status: 'active', tasks: '60/72', health: 'green' },
];

type AgentType = typeof DEPARTMENTS[0]['agents'][0];

export default function OpsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);
  const [view, setView] = useState<'grid' | 'org'>('grid');

  const totalAgents = DEPARTMENTS.reduce((s, d) => s + d.agents.length, 0);
  const activeAgents = DEPARTMENTS.reduce((s, d) => s + d.agents.filter(a => a.status === 'active').length, 0);

  return (
    <div className="min-h-screen bg-[#07070A] text-white p-6 sm:p-10">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-2xl font-bold">EYWA Operations Center</h1>
            </div>
            <p className="text-white/40 text-sm mt-1">AI Agent Workforce — EYWA Consulting Services Inc</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
              <button onClick={() => setView('grid')} className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${view === 'grid' ? 'bg-blue-600 text-white' : 'text-white/40'}`}>Grid</button>
              <button onClick={() => setView('org')} className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${view === 'org' ? 'bg-blue-600 text-white' : 'text-white/40'}`}>Org Chart</button>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{activeAgents} active</p>
              <p className="text-[11px] text-white/30">{totalAgents} total agents</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label="Agents" value={String(totalAgents)} sub={`${activeAgents} active now`} color="#3b82f6" />
          <StatBox label="Skills" value={String(SKILLS.reduce((s, sk) => s + sk.items.length, 0))} sub={`${SKILLS.length} skill packs`} color="#a855f7" />
          <StatBox label="Projects" value={String(PROJECTS.length)} sub="Estate AI" color="#22c55e" />
          <StatBox label="Task Progress" value="83%" sub="60 of 72 done" color="#f59e0b" />
        </div>

        {/* Project Banner */}
        {PROJECTS.map(p => (
          <div key={p.name} className="mb-8 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-xl">🏠</div>
              <div>
                <h2 className="font-bold text-lg">{p.name}</h2>
                <p className="text-xs text-white/40">{p.stack}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm font-semibold">{p.tasks} tasks</p>
                <p className="text-[11px] text-white/30">Command Center</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Live</span>
              </div>
            </div>
          </div>
        ))}

        {/* Department Grid */}
        {view === 'grid' && (
          <div className="space-y-8">
            {DEPARTMENTS.map(dept => (
              <div key={dept.name}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">{dept.icon}</span>
                  <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: dept.color }}>{dept.name}</h2>
                  <span className="text-xs text-white/20 ml-2">{dept.agents.length} agents</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {dept.agents.map(agent => (
                    <button key={agent.name} onClick={() => setSelectedAgent(agent)}
                      className={`relative p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer group ${
                        agent.status === 'active'
                          ? 'bg-white/[0.04] border-white/[0.12]'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                      }`}>
                      {agent.status === 'active' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[10px] text-emerald-400 font-medium">Active</span>
                        </div>
                      )}
                      <div className="text-2xl mb-2">{agent.avatar}</div>
                      <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                      <p className="text-[11px] text-white/35 mt-1 line-clamp-2">{agent.role}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {agent.skills.slice(0, 3).map(s => (
                          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/30">{s}</span>
                        ))}
                        {agent.skills.length > 3 && <span className="text-[9px] text-white/20">+{agent.skills.length - 3}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Org Chart View */}
        {view === 'org' && (
          <div className="space-y-4">
            {/* CEO */}
            <div className="flex justify-center">
              <div className="bg-white/[0.04] border border-white/[0.1] rounded-xl p-4 text-center w-48">
                <div className="text-2xl mb-1">👤</div>
                <p className="text-sm font-bold">Karim Hossien</p>
                <p className="text-[10px] text-white/30">CEO — EYWA Consulting</p>
              </div>
            </div>
            <div className="flex justify-center"><div className="w-px h-6 bg-white/10" /></div>
            {/* Claude */}
            <div className="flex justify-center">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center w-56">
                <div className="text-2xl mb-1">🤖</div>
                <p className="text-sm font-bold text-blue-400">Claude Opus 4.6</p>
                <p className="text-[10px] text-white/30">AI CTO — Orchestrates all agents</p>
              </div>
            </div>
            <div className="flex justify-center"><div className="w-px h-6 bg-white/10" /></div>
            {/* Departments */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {DEPARTMENTS.map(dept => (
                <div key={dept.name} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span>{dept.icon}</span>
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: dept.color }}>{dept.name}</h3>
                  </div>
                  <div className="space-y-2">
                    {dept.agents.map(a => (
                      <div key={a.name} className="flex items-center gap-2 text-xs">
                        <span>{a.avatar}</span>
                        <span className="text-white/60">{a.name}</span>
                        {a.status === 'active' && <div className="w-1 h-1 rounded-full bg-emerald-400 ml-auto" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills & MCP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-4">Skill Packs Installed</h3>
            <div className="space-y-3">
              {SKILLS.map(sk => (
                <div key={sk.name}>
                  <p className="text-sm font-semibold text-white mb-1.5">{sk.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {sk.items.map(item => (
                      <span key={item} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-4">MCP Servers</h3>
            <div className="space-y-3">
              {MCPS.map(mcp => (
                <div key={mcp.name} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <p className="text-sm font-semibold text-white">{mcp.name}</p>
                    <p className="text-[11px] text-white/30">{mcp.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${mcp.status === 'connected' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                    <span className={`text-[10px] font-medium ${mcp.status === 'connected' ? 'text-emerald-400' : 'text-white/30'}`}>{mcp.status}</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mt-6 mb-4">Infrastructure</h3>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Node.js Service', value: 'Render (free)', status: 'live' },
                { label: 'Python Webhook', value: 'Render (starter)', status: 'live' },
                { label: 'Database', value: 'Supabase (free)', status: 'live' },
                { label: 'AI Model', value: 'GPT-4o', status: 'live' },
                { label: 'Domain', value: 'realestate-ai.app', status: 'live' },
                { label: 'Monthly Burn', value: '$25.54', status: 'info' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <span className="text-white/40">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70">{item.value}</span>
                    {item.status === 'live' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedAgent(null)}>
          <div className="bg-[#111318] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedAgent.avatar}</span>
                <div>
                  <h3 className="text-lg font-bold">{selectedAgent.name}</h3>
                  <p className="text-xs text-white/40">{selectedAgent.status === 'active' ? '● Active' : '○ Idle'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-white/30 hover:text-white cursor-pointer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-sm text-white/60 mb-4">{selectedAgent.role}</p>
            <div>
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.skills.map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-white/30 mt-0.5">{sub}</p>
    </div>
  );
}
