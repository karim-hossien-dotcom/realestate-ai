'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Lead } from '@/app/lib/supabase/types';
import { DndContext, DragOverlay, closestCorners, useDroppable, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import LeadCard, { LeadRow, DraggableLeadCard } from '@/app/components/LeadCard';
import LeadDetailPanel from '@/app/components/LeadDetailPanel';
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads);
        setError(null);
      } else {
        setError(data.error || 'Failed to load leads');
      }
    } catch {
      setError('Network error loading leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
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
  });

  // Stats
  const totalLeads = leads.length;
  const withMessages = leads.filter(l => l.sms_text || l.email_text).length;
  const withPhone = leads.filter(l => l.phone).length;
  const hotLeads = leads.filter(l => l.score_category === 'Hot').length;

  // Import CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/leads/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        showToast(`Imported ${data.stats?.inserted || 0} leads`, 'success');
        fetchLeads();
      } else {
        showToast(data.error || 'Import failed', 'error');
      }
    } catch {
      showToast('Import failed', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) deleted++;
      } catch { /* continue */ }
    }
    showToast(`Deleted ${deleted} leads`, 'success');
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
          <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-28 animate-pulse"></div>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
          <button onClick={() => { setLoading(true); fetchLeads(); }} className="ml-4 text-sm underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalLeads} total leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <i className="fas fa-file-import mr-2"></i>
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <i className="fas fa-download mr-2"></i>Export
          </button>
          <button
            onClick={() => { setLoading(true); fetchLeads(); }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-list mr-1"></i>Table
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'kanban' ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="fas fa-columns mr-1"></i>Kanban
          </button>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-500 dark:text-gray-400">{selectedIds.size} selected</span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <i className="fas fa-trash-alt mr-1"></i>Delete
            </button>
          </div>
        )}
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
          onAction={leads.length === 0 ? () => fileInputRef.current?.click() : undefined}
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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <i className={`fas ${icon} text-sm`}></i>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={onSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden xl:table-cell">Last Contact</th>
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
      <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500 dark:text-gray-400">
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
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  const headerColor = colorMap[column.color] || colorMap.blue;

  return (
    <div className="flex-shrink-0 w-72 bg-gray-50 rounded-lg">
      <div className={`px-3 py-2 rounded-t-lg border ${headerColor} flex items-center justify-between`}>
        <span className="text-sm font-semibold">{column.label}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/50">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-400px)] overflow-y-auto transition-colors ${
          isOver ? 'bg-blue-50/50 ring-2 ring-blue-300 ring-inset rounded-b-lg' : ''
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
