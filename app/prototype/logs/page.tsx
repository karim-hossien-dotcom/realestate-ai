'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import { SkeletonCard } from '@/app/components/Skeleton';
import EmptyState from '@/app/components/EmptyState';

type LogEntry = {
  id: string;
  timestamp: string;
  eventType: string;
  description: string;
  user: string;
  status: string;
  metadata?: Record<string, unknown>;
};

type LogStats = {
  totalEvents: number;
  errorsToday: number;
  successRate: number;
  avgResponseTime: number;
};

type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

const EVENT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  campaign_send: { label: 'Campaign Send', icon: 'fa-paper-plane', color: 'blue' },
  message_reply: { label: 'Message Reply', icon: 'fa-reply', color: 'green' },
  error: { label: 'Error', icon: 'fa-exclamation-triangle', color: 'red' },
  appointment: { label: 'Appointment', icon: 'fa-calendar', color: 'purple' },
  data_import: { label: 'Data Import', icon: 'fa-upload', color: 'orange' },
  compliance: { label: 'Compliance', icon: 'fa-shield-alt', color: 'yellow' },
  opt_out: { label: 'Opt-Out', icon: 'fa-user-minus', color: 'gray' },
  followup: { label: 'Follow-Up', icon: 'fa-clock', color: 'indigo' },
  system: { label: 'System', icon: 'fa-cog', color: 'gray' },
};

const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  gray: 'bg-gray-100 text-gray-800',
  indigo: 'bg-indigo-100 text-indigo-800',
};

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-green-700',
  sent: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  warning: 'bg-yellow-100 text-yellow-700',
  received: 'bg-blue-100 text-blue-700',
};

export default function LogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const fetchLogs = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        range: rangeFilter,
      });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
        setStats(data.stats || null);
        setPagination(data.pagination || null);
      } else {
        showToast(data.error || 'Failed to load logs', 'error');
      }
    } catch {
      showToast('Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [rangeFilter, typeFilter, searchQuery, showToast]);

  useEffect(() => { fetchLogs(currentPage); }, [fetchLogs, currentPage]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    try {
      const params = new URLSearchParams({ format, range: rangeFilter });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/logs/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_export_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported as ${format.toUpperCase()}`, 'success');
    } catch {
      showToast('Export failed', 'error');
    }
  };

  const handleRetry = async (logId: string) => {
    setRetrying(logId);
    try {
      const res = await fetch('/api/logs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || 'Retry successful', 'success');
        fetchLogs(currentPage);
      } else {
        showToast(data.error || 'Retry failed', 'error');
      }
    } catch {
      showToast('Retry failed', 'error');
    } finally {
      setRetrying(null);
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Pagination helpers
  const pageNumbers = (): number[] => {
    if (!pagination) return [];
    const total = pagination.totalPages;
    const current = pagination.page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-gray-200 rounded-lg h-96 animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Logs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Monitor system events and message activity</p>
        </div>
        {stats && stats.errorsToday > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm">
            <i className="fas fa-bell"></i>
            <span>{stats.errorsToday} error{stats.errorsToday > 1 ? 's' : ''} today</span>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Events" value={String(stats.totalEvents)} icon="fa-list" color="blue" />
          <StatCard label="Errors Today" value={String(stats.errorsToday)} icon="fa-exclamation-triangle" color="red" />
          <StatCard label="Success Rate" value={`${stats.successRate}%`} icon="fa-check-circle" color="green" />
          <StatCard label="Avg Response" value={`${stats.avgResponseTime}s`} icon="fa-clock" color="purple" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(EVENT_TYPES).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>

        {/* Range filter */}
        <select
          value={rangeFilter}
          onChange={(e) => { setRangeFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
          >
            <i className="fas fa-download mr-1"></i>Export
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 w-32">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-t-lg"
              >
                <i className="fas fa-file-csv mr-2 text-green-600"></i>CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-b-lg"
              >
                <i className="fas fa-file-code mr-2 text-blue-600"></i>JSON
              </button>
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={() => { setLoading(true); fetchLogs(currentPage); }}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
          title="Refresh"
        >
          <i className="fas fa-sync-alt"></i>
        </button>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <EmptyState
          icon="fa-file-alt"
          title="No Logs Found"
          description="No activity logs match your current filters. Try adjusting the time range or search."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Event</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const et = EVENT_TYPES[log.eventType] || { label: log.eventType, icon: 'fa-circle', color: 'gray' };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${COLOR_BG[et.color] || COLOR_BG.gray}`}>
                          <i className={`fas ${et.icon}`}></i>
                          {et.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate hidden md:table-cell">
                        {log.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                        {log.user}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[log.status] || 'bg-gray-100 text-gray-700'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View
                          </button>
                          {log.status === 'failed' && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              disabled={retrying === log.id}
                              className="text-xs text-orange-600 hover:text-orange-800 disabled:opacity-50"
                            >
                              {retrying === log.id ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalItems)} of {pagination.totalItems}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {pageNumbers().map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} onRetry={handleRetry} formatTimestamp={formatTimestamp} />}

      {/* TODO: Add activity timeline chart and log distribution donut chart using recharts */}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
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

function LogDetailModal({ log, onClose, onRetry, formatTimestamp }: {
  log: LogEntry;
  onClose: () => void;
  onRetry: (id: string) => void;
  formatTimestamp: (ts: string) => string;
}) {
  const et = EVENT_TYPES[log.eventType] || { label: log.eventType, icon: 'fa-circle', color: 'gray' };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${COLOR_BG[et.color] || COLOR_BG.gray}`}>
              <i className={`fas ${et.icon}`}></i>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{et.label}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(log.timestamp)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">{log.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">User</p>
              <p className="text-gray-900 dark:text-gray-100">{log.user}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Status</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[log.status] || 'bg-gray-100 text-gray-700'}`}>
                {log.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Log ID</p>
              <p className="text-gray-600 font-mono text-xs truncate">{log.id}</p>
            </div>
            {log.metadata?.phone ? (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                <p className="text-gray-900 dark:text-gray-100">{String(log.metadata.phone)}</p>
              </div>
            ) : null}
            {log.metadata?.campaignName ? (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Campaign</p>
                <p className="text-gray-900 dark:text-gray-100">{String(log.metadata.campaignName)}</p>
              </div>
            ) : null}
          </div>

          {log.metadata?.errorMessage ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Error Details</p>
              <p className="text-sm text-red-600">{String(log.metadata.errorMessage)}</p>
            </div>
          ) : null}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Metadata</p>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {log.status === 'failed' && (
              <button
                onClick={() => { onRetry(log.id); onClose(); }}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium transition-colors"
              >
                <i className="fas fa-redo mr-2"></i>Retry Action
              </button>
            )}
            {(log.eventType === 'message_reply' || log.eventType === 'campaign_send') && (
              <button
                onClick={() => { window.location.href = '/prototype/conversations'; }}
                className="px-4 py-2 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
              >
                <i className="fas fa-comments mr-2"></i>View Conversation
              </button>
            )}
            {log.eventType === 'appointment' && (
              <button
                onClick={() => { window.location.href = '/prototype/calendar'; }}
                className="px-4 py-2 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 text-sm font-medium transition-colors"
              >
                <i className="fas fa-calendar mr-2"></i>View Calendar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
