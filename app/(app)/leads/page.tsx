'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Lead } from '@/app/lib/supabase/types';
import { DndContext, DragOverlay, closestCorners, useDroppable, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import LeadCard, { LeadRow, DraggableLeadCard } from '@/app/components/LeadCard';
import LeadDetailPanel from '@/app/components/LeadDetailPanel';
import ImportModal from '@/app/components/ImportModal';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonTable, SkeletonCard } from '@/app/components/Skeleton';
import { useToast } from '@/app/components/ToastProvider';

const PIPELINE_COLUMNS = [
  { status: 'new', label: 'New', color: 'blue' },
  { status: 'contacted', label: 'Contacted', color: 'yellow' },
  { status: 'interested', label: 'Interested', color: 'green' },
  { status: 'qualified', label: 'Qualified', color: 'emerald' },
  { status: 'meeting_scheduled', label: 'Meeting', color: 'purple' },
  { status: 'hot', label: 'Hot', color: 'red' },
];

const ALL_STATUSES = [
  'new', 'contacted', 'interested', 'qualified', 'meeting_scheduled',
  'hot', 'not_interested', 'do_not_contact', 'dead',
];

export default function LeadsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilters, setScoreFilters] = useState<Set<string>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'last_contacted' | 'created_at'>('score');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);

  const fetchLeads = useCallback(async (p?: number) => {
    try {
      const currentPage = p ?? page;
      const res = await fetch(`/api/leads?page=${currentPage}&limit=50`);
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads);
        setTotalPages(data.totalPages || 1);
        setTotalLeads(data.total || 0);
        setError(null);
      } else {
        setError(data.error || 'Failed to load leads');
      }
    } catch {
      setError('Network error loading leads');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Auto-open import modal when navigated with ?import=true (e.g. from onboarding)
  useEffect(() => {
    if (searchParams.get('import') === 'true') {
      setImportModalOpen(true);
    }
  }, [searchParams]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    if (showTagDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagDropdown]);

  // Collect all unique tags across leads for tag filter options
  const allTags = Array.from(
    new Set(leads.flatMap(l => l.tags || []))
  ).sort();

  const toggleScoreFilter = (category: string) => {
    setScoreFilters(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilters(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  // Filter leads
  const filteredLeads = leads
    .filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (scoreFilters.size > 0 && !scoreFilters.has(lead.score_category)) return false;
      if (tagFilters.size > 0) {
        const leadTags = lead.tags || [];
        const hasMatchingTag = Array.from(tagFilters).some(t => leadTags.includes(t));
        if (!hasMatchingTag) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (lead.owner_name || '').toLowerCase().includes(q) ||
          (lead.phone || '').includes(q) ||
          (lead.email || '').toLowerCase().includes(q) ||
          (lead.property_address || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score;
        case 'name':
          return (a.owner_name || '').localeCompare(b.owner_name || '');
        case 'last_contacted': {
          const aDate = a.last_contacted ? new Date(a.last_contacted).getTime() : 0;
          const bDate = b.last_contacted ? new Date(b.last_contacted).getTime() : 0;
          return bDate - aDate;
        }
        case 'created_at': {
          const aDate = new Date(a.created_at).getTime();
          const bDate = new Date(b.created_at).getTime();
          return bDate - aDate;
        }
        default:
          return 0;
      }
    });

  // Stats (totalLeads comes from API pagination metadata)
  const withMessages = leads.filter(l => l.sms_text || l.email_text).length;
  const withPhone = leads.filter(l => l.phone).length;
  const hotLeads = leads.filter(l => l.score_category === 'Hot').length;

  // Generate Messages
  const handleGenerateMessages = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/listing-agent/basic-run', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const count = data.data?.leadCount || 0;
        showToast(
          data.demo
            ? 'Demo mode: Set OPENAI_API_KEY to generate real messages'
            : `Generated messages for ${count} leads`,
          data.demo ? 'info' : 'success'
        );
        fetchLeads();
      } else {
        showToast(data.error || 'Generation failed', 'error');
      }
    } catch {
      showToast('Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Export
  const handleExport = async () => {
    try {
      const res = await fetch('/api/leads/export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Leads exported', 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} leads?`)) return;
    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Deleted ${data.deleted} leads`, 'success');
      } else {
        showToast(data.error || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
    setSelectedIds(new Set());
    fetchLeads();
  };

  // Selection handlers
  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  // Update lead in local state
  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l));
    if (selectedLead?.id === updatedLead.id) {
      setSelectedLead({ ...selectedLead, ...updatedLead });
    }
  };

  // Kanban drag-and-drop status change (optimistic)
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const previousLeads = [...leads];
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!data.ok) {
        setLeads(previousLeads);
        showToast('Failed to update status', 'error');
      } else {
        showToast(`Moved to ${newStatus.replace(/_/g, ' ')}`, 'success');
      }
    } catch {
      setLeads(previousLeads);
      showToast('Network error', 'error');
    }
  };

  // Delete lead from local state
  const handleLeadDelete = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-28 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
          <button onClick={() => { setLoading(true); fetchLeads(); }} className="ml-4 text-sm underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={() => fetchLeads()}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Leads</h1>
          <p className="text-sm text-[var(--text-secondary)]">{totalLeads} total leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <i className="fas fa-file-import mr-2"></i>
            Import CSV
          </button>
          {leads.filter(l => !l.sms_text).length > 0 && (
            <button
              onClick={handleGenerateMessages}
              disabled={generating}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <i className={`fas ${generating ? 'fa-spinner fa-spin' : 'fa-magic'} mr-2`}></i>
              {generating ? 'Generating...' : 'Generate Messages'}
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <i className="fas fa-download mr-2"></i>Export
          </button>
          <button
            onClick={() => { setLoading(true); fetchLeads(); }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm transition-colors"
            title="Refresh"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads} icon="fa-users" color="blue" />
        <StatCard label="With Messages" value={withMessages} icon="fa-envelope" color="green" />
        <StatCard label="With Phone" value={withPhone} icon="fa-phone" color="purple" />
        <StatCard label="Hot Leads" value={hotLeads} icon="fa-fire" color="red" />
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 space-y-3">
        {/* Row 1: Search, Status, View Toggle, Bulk */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--surface-elevated)] text-[var(--text-primary)] focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="score">Sort: Score</option>
            <option value="name">Sort: Name (A-Z)</option>
            <option value="last_contacted">Sort: Last Contacted</option>
            <option value="created_at">Sort: Date Added</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-[var(--surface-elevated)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-[var(--surface)] shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <i className="fas fa-list mr-1"></i>Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-[var(--surface)] shadow text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <i className="fas fa-columns mr-1"></i>Kanban
            </button>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-[var(--text-secondary)]">{selectedIds.size} selected</span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <i className="fas fa-trash-alt mr-1"></i>Delete
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Score chips + Tags */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Score chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-secondary)] mr-0.5">Score:</span>
            {(['Hot', 'Warm', 'Cold', 'Dead'] as const).map(cat => {
              const active = scoreFilters.has(cat);
              const colorMap: Record<string, string> = {
                Hot: active ? 'bg-red-600 text-white border-red-600' : 'border-red-500/40 text-red-400 hover:bg-red-500/10',
                Warm: active ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10',
                Cold: active ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10',
                Dead: active ? 'bg-gray-600 text-white border-gray-600' : 'border-gray-500/40 text-gray-400 hover:bg-gray-500/10',
              };
              return (
                <button
                  key={cat}
                  onClick={() => toggleScoreFilter(cat)}
                  className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${colorMap[cat]}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Tags multi-select dropdown */}
          {allTags.length > 0 && (
            <div className="relative" ref={tagDropdownRef}>
              <button
                onClick={() => setShowTagDropdown(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                  tagFilters.size > 0
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                <i className="fas fa-tags text-[10px]"></i>
                Tags{tagFilters.size > 0 ? ` (${tagFilters.size})` : ''}
                <i className={`fas fa-chevron-down text-[8px] ml-0.5 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`}></i>
              </button>
              {showTagDropdown && (
                <div className="absolute z-20 top-full mt-1 left-0 w-56 max-h-48 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg p-2 space-y-0.5">
                  {allTags.map(tag => (
                    <label
                      key={tag}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface-elevated)] cursor-pointer text-xs text-[var(--text-primary)]"
                    >
                      <input
                        type="checkbox"
                        checked={tagFilters.has(tag)}
                        onChange={() => toggleTagFilter(tag)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      {tag}
                    </label>
                  ))}
                  {tagFilters.size > 0 && (
                    <button
                      onClick={() => setTagFilters(new Set())}
                      className="w-full text-left px-2 py-1.5 text-xs text-blue-400 hover:text-blue-300"
                    >
                      Clear tags
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active filter summary + clear */}
          {(scoreFilters.size > 0 || tagFilters.size > 0 || statusFilter !== 'all') && (
            <div className="flex items-center gap-2 ml-auto text-xs text-[var(--text-secondary)]">
              <span>{filteredLeads.length} of {leads.length} leads</span>
              <button
                onClick={() => {
                  setScoreFilters(new Set());
                  setTagFilters(new Set());
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {filteredLeads.length === 0 ? (
        <EmptyState
          icon="fa-users"
          title={leads.length === 0 ? 'No Leads Yet' : 'No Matching Leads'}
          description={
            leads.length === 0
              ? 'Import your first leads from a CSV file to get started.'
              : 'Try adjusting your search or filter criteria.'
          }
          actionLabel={leads.length === 0 ? 'Import Leads' : undefined}
          onAction={leads.length === 0 ? () => setImportModalOpen(true) : undefined}
        />
      ) : viewMode === 'table' ? (
        <TableView
          leads={filteredLeads}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onSelectAll={toggleSelectAll}
          onClickLead={setSelectedLead}
        />
      ) : (
        <KanbanView leads={filteredLeads} onClickLead={setSelectedLead} onStatusChange={handleStatusChange} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-secondary)]">
            Page {page} of {totalPages} ({totalLeads} leads)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const p = page - 1; setPage(p); fetchLeads(p); }}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => { const p = page + 1; setPage(p); fetchLeads(p); }}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--surface-elevated)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
          onDelete={handleLeadDelete}
        />
      )}
    </div>
  );
}

// === Sub-components ===

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  };
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <i className={`fas ${icon} text-sm`}></i>
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function TableView({
  leads,
  selectedIds,
  onSelect,
  onSelectAll,
  onClickLead,
}: {
  leads: Lead[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClickLead: (lead: Lead) => void;
}) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={onSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide hidden lg:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide hidden xl:table-cell">Last Contact</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onClick={onClickLead}
                selected={selectedIds.has(lead.id)}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-[var(--border)] text-sm text-[var(--text-secondary)]">
        Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function KanbanColumn({ column, leads, onClickLead }: {
  column: typeof PIPELINE_COLUMNS[number];
  leads: Lead[];
  onClickLead: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status });
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-500/10 dark:border-yellow-500/30 dark:text-yellow-300',
    green: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300',
    purple: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300',
    red: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300',
  };
  const headerColor = colorMap[column.color] || colorMap.blue;

  return (
    <div className="flex-shrink-0 w-72 bg-gray-50 dark:bg-[var(--surface)] rounded-lg">
      <div className={`px-3 py-2 rounded-t-lg border ${headerColor} flex items-center justify-between`}>
        <span className="text-sm font-semibold">{column.label}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-white/10">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto transition-colors ${
          isOver ? 'bg-blue-50/50 dark:bg-blue-500/10 ring-2 ring-blue-300 dark:ring-blue-500/50 ring-inset rounded-b-lg' : ''
        }`}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No leads</p>
          ) : (
            leads.map((lead) => (
              <DraggableLeadCard key={lead.id} lead={lead} onClick={onClickLead} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function KanbanView({ leads, onClickLead, onStatusChange }: {
  leads: Lead[];
  onClickLead: (lead: Lead) => void;
  onStatusChange: (leadId: string, newStatus: string) => void;
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const currentLead = leads.find(l => l.id === leadId);
    if (!currentLead) return;

    // Determine target column — over.id could be a column status or another lead's id
    let targetStatus = over.id as string;
    const isColumn = PIPELINE_COLUMNS.some(c => c.status === targetStatus);
    if (!isColumn) {
      // Dropped on a lead card — find which column that lead is in
      const targetLead = leads.find(l => l.id === targetStatus);
      if (targetLead) targetStatus = targetLead.status;
    }

    if (currentLead.status !== targetStatus) {
      onStatusChange(leadId, targetStatus);
    }
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {PIPELINE_COLUMNS.map((col) => {
          const columnLeads = leads.filter(l => l.status === col.status);
          return (
            <KanbanColumn
              key={col.status}
              column={col}
              leads={columnLeads}
              onClickLead={onClickLead}
            />
          );
        })}
      </div>
      <DragOverlay>
        {activeLead && (
          <div className="w-72 rotate-2 shadow-xl">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
