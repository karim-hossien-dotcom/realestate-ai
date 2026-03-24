'use client'

import { Card, StatCard } from './AdminShared'
import { AgentBoardroom, SECURITY_AGENTS, agentStyles } from './AgentCharacters'

interface SecurityTabProps {
  alerts: Array<{ title: string; severity: string; message: string }>
}

const SECURITY_CHECKS = [
  { label: 'Middleware Rate Limiting', status: 'active', detail: 'Auth: 5/15min, API: 60/min, Public: 20/min' },
  { label: 'CSP Headers', status: 'active', detail: 'X-Frame-Options, CSP, nosniff, Referrer-Policy' },
  { label: 'Auth on All Routes', status: 'active', detail: 'withAuth() on 47/54 routes (7 public by design)' },
  { label: 'CRM Key Encryption', status: 'active', detail: 'AES-256-GCM via ENCRYPTION_KEY env var' },
  { label: 'Input Sanitization', status: 'active', detail: 'Zod schemas + safeParseBody + UUID validation' },
  { label: 'DNC Enforcement', status: 'active', detail: 'Checked before every outbound send' },
  { label: 'Supabase RLS', status: 'active', detail: 'Enabled on all 18+ tables' },
  { label: 'Stripe Signature', status: 'active', detail: 'HMAC verification on webhook' },
  { label: 'WhatsApp Signature', status: 'pending', detail: 'META_APP_SECRET not set yet' },
  { label: 'STOP Keyword Verification', status: 'active', detail: 'AI stop intent confirmed by keyword checker' },
]

const OPS_METRICS = [
  { label: 'Double Replies', target: '0', desc: 'AI sent 2 msgs <30s apart' },
  { label: 'Duplicate Sends', target: '0', desc: 'Same message sent 3+ times' },
  { label: 'Name Repetition', target: '<5%', desc: '"Got it, [Name]" openers' },
  { label: 'Vague Closers', target: '0', desc: '"Anything else?" responses' },
  { label: 'False Unsubscribes', target: '0', desc: 'Non-STOP treated as opt-out' },
  { label: 'Avg Response Time', target: '<15s', desc: 'AI reply latency' },
]

export default function SecurityTab({ alerts }: SecurityTabProps) {
  const activeChecks = SECURITY_CHECKS.filter(c => c.status === 'active').length
  const pendingChecks = SECURITY_CHECKS.filter(c => c.status === 'pending').length
  const securityAlerts = alerts.filter(a => a.severity === 'critical' || a.title.toLowerCase().includes('security'))

  return (
    <div className="space-y-4">
      <style>{agentStyles}</style>

      {/* Agent Characters */}
      <AgentBoardroom agents={SECURITY_AGENTS} teamColor="#EF4444" teamName="Security" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Security Checks" value={activeChecks} sub={`${pendingChecks} pending`} />
        <StatCard label="Ops Metrics Tracked" value={OPS_METRICS.length} sub="From weekly audit" />
        <StatCard label="Security Alerts" value={securityAlerts.length} sub="Active issues" alert={securityAlerts.length > 0 ? 'red' : undefined} />
      </div>

      {/* Security Checklist */}
      <Card title="Security Posture" accent="#EF4444">
        <div className="space-y-1">
          {SECURITY_CHECKS.map((check) => (
            <div key={check.label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${check.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <span className="text-sm text-[var(--text-primary)]">{check.label}</span>
                  <p className="text-[10px] text-[var(--text-secondary)]">{check.detail}</p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                check.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}>
                {check.status === 'active' ? 'Active' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* AI Ops Health Metrics */}
      <Card title="AI Ops Health (from Weekly Audit)" accent="var(--primary)">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {OPS_METRICS.map(m => (
            <div key={m.label} className="p-3 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{m.label}</div>
              <div className="text-lg font-bold text-[var(--text-primary)] mt-0.5">{m.target}</div>
              <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">{m.desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rate Limiting Config */}
      <Card title="Rate Limiting Configuration" accent="#F59E0B">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 text-[var(--text-secondary)] font-medium">Scope</th>
                <th className="text-left py-2 text-[var(--text-secondary)] font-medium">Limit</th>
                <th className="text-left py-2 text-[var(--text-secondary)] font-medium">Window</th>
                <th className="text-left py-2 text-[var(--text-secondary)] font-medium">Layer</th>
              </tr>
            </thead>
            <tbody>
              {[
                { scope: 'Auth routes (login/signup)', limit: '5 requests', window: '15 minutes', layer: 'Middleware' },
                { scope: 'Public API (plans, unsubscribe)', limit: '20 requests', window: '1 minute', layer: 'Middleware' },
                { scope: 'All API routes', limit: '60 requests', window: '1 minute', layer: 'Middleware' },
                { scope: 'WhatsApp send', limit: '30 sends', window: '1 minute', layer: 'Route' },
                { scope: 'Campaign per contact', limit: '20 messages', window: '1 day', layer: 'Route (RPC)' },
                { scope: 'Exports', limit: '5 requests', window: '1 minute', layer: 'Route' },
                { scope: 'Python webhook', limit: '60 requests', window: '1 minute', layer: 'IP-based' },
              ].map(r => (
                <tr key={r.scope} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 text-[var(--text-primary)]">{r.scope}</td>
                  <td className="py-2 text-[var(--text-primary)] font-medium">{r.limit}</td>
                  <td className="py-2 text-[var(--text-secondary)]">{r.window}</td>
                  <td className="py-2"><span className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-secondary)]">{r.layer}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
