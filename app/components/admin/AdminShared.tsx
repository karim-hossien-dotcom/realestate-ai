'use client'

import { useState } from 'react'
import { BADGE_STYLES, type Task } from './admin-types'

// ── Badge ──
export function Badge({ text, variant = 'default' }: { text: string; variant?: string }) {
  const cls = BADGE_STYLES[variant] || BADGE_STYLES.default
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${cls}`}>
      {text}
    </span>
  )
}

// ── Status checkbox ──
export function StatusToggle({ task, onToggle }: { task: Task; onToggle: (id: string, status: string) => void }) {
  const done = task.status === 'completed'
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(task.id, done ? 'pending' : 'completed') }}
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
        done ? 'border-emerald-400 bg-emerald-400/10' : 'border-[var(--border)] bg-transparent hover:border-[var(--text-secondary)]'
      }`}
      title={done ? 'Mark as pending' : 'Mark as completed'}
    >
      {done && <span className="text-emerald-400 text-xs font-bold">{'\u2713'}</span>}
    </button>
  )
}

// ── Task row ──
export function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string, status: string) => void }) {
  const pColor = task.priority === 'P0' ? 'red' : task.priority === 'P1' ? 'amber' : 'default'
  const done = task.status === 'completed'
  const isP0Active = task.priority === 'P0' && !done
  return (
    <div className={`flex items-start justify-between gap-3 px-3.5 py-3 rounded-lg border mb-1.5 transition-all ${
      isP0Active ? 'border-red-500/20 bg-red-500/5' : 'border-[var(--border)] hover:bg-[var(--surface-elevated)]'
    } ${done ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="mt-0.5"><StatusToggle task={task} onToggle={onToggle} /></div>
        <div className="mt-0.5"><Badge text={task.priority} variant={pColor} /></div>
        <div className="min-w-0">
          <div className={`text-[13px] font-medium text-[var(--text-primary)] ${done ? 'line-through' : ''}`}>{task.title}</div>
          {task.description && <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{task.description}</div>}
          {task.completed_by && done && (
            <div className="text-[10px] text-emerald-400 mt-0.5">
              Completed by {task.completed_by === 'claude_code' ? 'Claude Code' : task.completed_by}
              {task.completed_at && ` \u00B7 ${new Date(task.completed_at).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {task.channel && <Badge text={task.channel} variant="blue" />}
        {task.is_blocker && !done && <Badge text="BLOCKER" variant="red" />}
        {task.is_automatable && <Badge text="AI" variant="purple" />}
        {done && <Badge text="DONE" variant="green" />}
      </div>
    </div>
  )
}

// ── Card wrapper ──
export function Card({ title, accent, children, className = '' }: {
  title?: string; accent?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden ${className}`}>
      {accent && <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />}
      <div className="p-5">
        {title && <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-[1.5px] mb-4">{title}</div>}
        {children}
      </div>
    </div>
  )
}

// ── Stat card ──
export function StatCard({ label, value, sub, alert }: {
  label: string; value: string | number; sub?: string; alert?: string
}) {
  return (
    <div className={`bg-[var(--surface)] border rounded-xl p-5 transition-colors hover:border-[var(--primary)] ${
      alert === 'red' ? 'border-red-500/20' : alert === 'amber' ? 'border-amber-500/20' : 'border-[var(--border)]'
    }`}>
      {alert === 'red' && <div className="h-0.5 -mt-5 -mx-5 mb-4" style={{ background: 'linear-gradient(90deg, #FF4444, transparent)' }} />}
      <div className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-[1.2px]">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${alert === 'red' ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

// ── Filter button ──
export function FilterBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
      active
        ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
        : 'border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`}>
      {label}
    </button>
  )
}

// ── Department tab ──
export function DeptTab({ department, tasks, onToggle, filters }: {
  department: string; tasks: Task[]; onToggle: (id: string, s: string) => void; filters: string[]
}) {
  const [filter, setFilter] = useState('all')
  const [showDone, setShowDone] = useState(false)

  const deptTasks = tasks.filter(t => t.department === department)
  let filtered = filter === 'all'
    ? deptTasks
    : filter === 'auto'
      ? deptTasks.filter(t => t.is_automatable)
      : deptTasks.filter(t => t.priority === filter)

  if (!showDone) filtered = filtered.filter(t => t.status !== 'completed')
  const doneCount = deptTasks.filter(t => t.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <FilterBtn active={filter === 'all'} label={`All (${deptTasks.length})`} onClick={() => setFilter('all')} />
          {filters.map(f => (
            <FilterBtn key={f} active={filter === f}
              label={f === 'auto' ? 'AI-Assisted' : `${f} (${deptTasks.filter(t => t.priority === f).length})`}
              onClick={() => setFilter(f)} />
          ))}
        </div>
        <button onClick={() => setShowDone(!showDone)} className={`px-3.5 py-1.5 rounded-lg text-xs border transition-all cursor-pointer ${
          showDone ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[var(--border)] text-[var(--text-secondary)]'
        }`}>
          {showDone ? `Hide completed (${doneCount})` : `Show completed (${doneCount})`}
        </button>
      </div>
      {filtered.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
      {filtered.length === 0 && (
        <div className="py-10 text-center text-[var(--text-secondary)] text-sm">
          {showDone ? 'No tasks match this filter.' : 'All tasks completed!'}
        </div>
      )}
    </div>
  )
}
