'use client'

/**
 * Pixel art agent characters for Command Center department tabs.
 * Each agent is an SVG pixel art character with idle/active animations.
 */

interface AgentCharacter {
  name: string
  role: string
  avatar: string // SVG pixel art inline
  color: string
  skills: string[]
  status: 'active' | 'idle'
}

// Pixel art SVG generator — creates a simple 8x8 pixel character
function PixelAgent({ color, expression, accessory }: { color: string; expression: 'happy' | 'focused' | 'alert'; accessory?: string }) {
  // 8x8 grid pixel art character
  const skin = '#FFD5B0'
  const hair = color
  const eyes = expression === 'alert' ? '#FF4444' : '#222'
  const mouth = expression === 'happy' ? '#CC6666' : '#AA8888'

  return (
    <svg viewBox="0 0 8 8" width="48" height="48" className="pixelated">
      {/* Hair */}
      <rect x="2" y="0" width="4" height="1" fill={hair} />
      <rect x="1" y="1" width="6" height="1" fill={hair} />
      {/* Face */}
      <rect x="1" y="2" width="6" height="3" fill={skin} />
      {/* Eyes */}
      <rect x="2" y="3" width="1" height="1" fill={eyes} />
      <rect x="5" y="3" width="1" height="1" fill={eyes} />
      {/* Mouth */}
      <rect x="3" y="4" width="2" height="0.5" fill={mouth} />
      {/* Body */}
      <rect x="1" y="5" width="6" height="2" fill={color} />
      {/* Legs */}
      <rect x="2" y="7" width="1" height="1" fill="#444" />
      <rect x="5" y="7" width="1" height="1" fill="#444" />
      {/* Accessory */}
      {accessory === 'shield' && <rect x="0" y="5" width="1" height="2" fill="#EF4444" />}
      {accessory === 'laptop' && <rect x="7" y="5" width="1" height="1" fill="#60A5FA" />}
      {accessory === 'chart' && <rect x="7" y="4" width="1" height="2" fill="#22C55E" />}
      {accessory === 'magnifier' && <><rect x="7" y="3" width="1" height="1" fill="#FCD34D" /><rect x="7" y="4" width="0.5" height="1" fill="#92400E" /></>}
      {accessory === 'gavel' && <rect x="0" y="4" width="1" height="2" fill="#A855F7" />}
      {accessory === 'megaphone' && <rect x="7" y="3" width="1" height="2" fill="#F59E0B" />}
    </svg>
  )
}

// ── Engineering Agents ──
export const ENGINEERING_AGENTS: AgentCharacter[] = [
  { name: 'Architect', role: 'System design', avatar: '🏗️', color: '#3B82F6', skills: ['System Design', 'DB Schema', 'API Arch'], status: 'idle' },
  { name: 'Planner', role: 'Task decomposition', avatar: '📋', color: '#2563EB', skills: ['Phasing', 'Dependencies', 'Estimation'], status: 'idle' },
  { name: 'TDD Guide', role: 'Tests first', avatar: '🧪', color: '#0EA5E9', skills: ['Vitest', 'Unit Tests', 'Coverage'], status: 'idle' },
  { name: 'Code Reviewer', role: 'Quality & security', avatar: '🔍', color: '#6366F1', skills: ['Code Quality', 'Security', 'Perf'], status: 'idle' },
  { name: 'Build Resolver', role: 'Fix build failures', avatar: '🔧', color: '#3B82F6', skills: ['TypeScript', 'Next.js', 'Debug'], status: 'idle' },
  { name: 'Refactor', role: 'Clean dead code', avatar: '🧹', color: '#2563EB', skills: ['Dead Code', 'Simplification'], status: 'idle' },
  { name: 'E2E Runner', role: 'End-to-end tests', avatar: '🎯', color: '#0EA5E9', skills: ['Playwright', 'User Flows'], status: 'idle' },
  { name: 'Doc Updater', role: 'Keep docs synced', avatar: '📝', color: '#6366F1', skills: ['CLAUDE.md', 'API Docs'], status: 'idle' },
  { name: 'Eng Ops', role: 'Health & delivery', avatar: '📊', color: '#3B82F6', skills: ['Monitoring', 'Deploys', 'Cron'], status: 'active' },
]

// ── Security Agents ──
export const SECURITY_AGENTS: AgentCharacter[] = [
  { name: 'Security', role: 'Vulnerabilities & audits', avatar: '🔐', color: '#EF4444', skills: ['OWASP', 'Rate Limiting', 'CSP', 'Secrets', 'Sanitization'], status: 'active' },
]

// ── Business Agents ──
export const BUSINESS_AGENTS: AgentCharacter[] = [
  { name: 'Finance', role: 'Costs & revenue', avatar: '💰', color: '#A855F7', skills: ['Burn Rate', 'Margins', 'Unit Econ'], status: 'idle' },
  { name: 'Legal', role: 'Compliance & policy', avatar: '⚖️', color: '#8B5CF6', skills: ['TCPA', 'CCPA', 'GDPR', 'DNC'], status: 'idle' },
  { name: 'Marketing', role: 'Content & campaigns', avatar: '📣', color: '#D946EF', skills: ['LinkedIn', 'Ads', 'Email', 'Landing'], status: 'active' },
  { name: 'Research', role: 'Competitive intel', avatar: '🔬', color: '#A855F7', skills: ['Competitors', 'Sentiment', 'Trends'], status: 'idle' },
]

interface AgentBoardroomProps {
  agents: AgentCharacter[]
  teamColor: string
  teamName: string
}

export function AgentBoardroom({ agents, teamColor, teamName }: AgentBoardroomProps) {
  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ background: teamColor }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: teamColor }}>{teamName} Team</span>
        <span className="text-[10px] text-[var(--text-secondary)]">{agents.length} agents</span>
      </div>

      {/* Boardroom table */}
      <div className="relative">
        {/* Conference table */}
        <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg opacity-30" />

        {/* Agent seats */}
        <div className="relative grid grid-cols-3 sm:grid-cols-5 gap-3 py-4">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className={`flex flex-col items-center p-2 rounded-lg transition-all cursor-default group ${
                agent.status === 'active'
                  ? 'bg-white/[0.04]'
                  : 'opacity-50 hover:opacity-80'
              }`}
            >
              {/* Character */}
              <div className={`relative ${agent.status === 'active' ? 'animate-bounce-slow' : ''}`}>
                <PixelAgent
                  color={agent.color}
                  expression={agent.status === 'active' ? 'focused' : 'happy'}
                  accessory={
                    agent.name === 'Security' ? 'shield' :
                    agent.name === 'Eng Ops' ? 'laptop' :
                    agent.name === 'Finance' ? 'chart' :
                    agent.name === 'Research' ? 'magnifier' :
                    agent.name === 'Legal' ? 'gavel' :
                    agent.name === 'Marketing' ? 'megaphone' : undefined
                  }
                />
                {agent.status === 'active' && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[var(--surface)]">
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
                  </div>
                )}
              </div>

              {/* Name plate */}
              <div className="mt-1.5 text-center">
                <p className="text-[10px] font-semibold text-[var(--text-primary)] leading-tight">{agent.name}</p>
                <p className="text-[8px] text-[var(--text-secondary)] leading-tight">{agent.role}</p>
              </div>

              {/* Skills tooltip on hover */}
              <div className="hidden group-hover:flex flex-wrap gap-0.5 mt-1 justify-center">
                {agent.skills.slice(0, 3).map(s => (
                  <span key={s} className="text-[7px] px-1 py-0.5 rounded bg-white/[0.06] text-[var(--text-secondary)]">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// CSS for pixel art rendering and slow bounce
export const agentStyles = `
  .pixelated {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  @keyframes bounce-slow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  .animate-bounce-slow {
    animation: bounce-slow 2s ease-in-out infinite;
  }
`
