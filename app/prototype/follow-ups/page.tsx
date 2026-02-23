'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonCard } from '@/app/components/Skeleton';

type FollowUpItem = {
  id: string;
  leadId: string;
  phone: string | null;
  ownerName: string | null;
  propertyAddress: string | null;
  daysSinceContact: number;
  lastSent: string;
  lastResponse?: string;
  responseStatus: 'no_response' | 'replied' | 'needs_followup' | 'interested' | 'not_interested';
  suggestedAction: string;
  originalMessage: string;
};

type Stats = {
  total: number;
  no_response: number;
  needs_followup: number;
  replied: number;
};

const URGENCY_COLORS: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  darkred: 'bg-red-200 text-red-800',
};

function getUrgency(days: number): { color: string; label: string } {
  if (days <= 0) return { color: 'green', label: 'Today' };
  if (days <= 3) return { color: 'green', label: `${days}d ago` };
  if (days <= 7) return { color: 'yellow', label: `${days}d ago` };
  if (days <= 14) return { color: 'orange', label: `${days}d ago` };
  if (days <= 30) return { color: 'red', label: `${days}d ago` };
  return { color: 'darkred', label: `${days}d ago` };
}

const STATUS_STYLES: Record<string, string> = {
  no_response: 'bg-gray-100 text-gray-700',
  replied: 'bg-green-100 text-green-700',
  needs_followup: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-blue-100 text-blue-700',
  not_interested: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  no_response: 'No Response',
  replied: 'Replied',
  needs_followup: 'Needs Follow-Up',
  interested: 'Interested',
  not_interested: 'Not Interested',
};

export default function FollowUpsPage() {
  const { showToast } = useToast();
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchFollowups = useCallback(async () => {
    try {
      const res = await fetch('/api/followups');
      const data = await res.json();
      if (data.ok) {
        setFollowups(data.followups || []);
        setStats(data.stats || null);
        setError(null);
      } else {
        setError(data.error || 'Failed to load follow-ups');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const res = await fetch('/api/followups/build', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast(`Built ${data.data?.followUpsCreated || 0} follow-ups`, 'success');
        fetchFollowups();
      } else {
        showToast(data.error || 'Build failed', 'error');
      }
    } catch {
      showToast('Build failed', 'error');
    } finally {
      setBuilding(false);
    }
  };

  const filteredFollowups = followups.filter((f) => {
    if (filterStatus === 'all') return true;
    return f.responseStatus === filterStatus;
  });

  const filterTabs = [
    { key: 'all', label: 'All', count: stats?.total || followups.length },
    { key: 'no_response', label: 'No Response', count: stats?.no_response || 0 },
    { key: 'needs_followup', label: 'Needs Follow-Up', count: stats?.needs_followup || 0 },
    { key: 'replied', label: 'Replied', count: stats?.replied || 0 },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <i className="fas fa-exclamation-circle mr-2"></i>{error}
          <button onClick={() => { setLoading(true); fetchFollowups(); }} className="ml-4 text-sm underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Follow-Ups</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track and manage lead follow-up activities</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBuild}
            disabled={building}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            <i className="fas fa-magic mr-2"></i>
            {building ? 'Building...' : 'Build Follow-Ups'}
          </button>
          <button
            onClick={() => { setLoading(true); fetchFollowups(); }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
            title="Refresh"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} icon="fa-clock" color="blue" />
          <StatCard label="No Response" value={stats.no_response} icon="fa-exclamation" color="red" />
          <StatCard label="Needs Follow-Up" value={stats.needs_followup} icon="fa-bell" color="yellow" />
          <StatCard label="Replied" value={stats.replied} icon="fa-check" color="green" />
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              filterStatus === tab.key
                ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Follow-up Cards */}
      {filteredFollowups.length === 0 ? (
        <EmptyState
          icon="fa-clock"
          title={followups.length === 0 ? 'No Follow-Ups Yet' : 'No Matching Follow-Ups'}
          description={
            followups.length === 0
              ? 'Build follow-ups for your leads to start tracking response status.'
              : 'Try a different filter to see more results.'
          }
          actionLabel={followups.length === 0 ? 'Build Follow-Ups' : undefined}
          onAction={followups.length === 0 ? handleBuild : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredFollowups.map((fu) => {
            const urgency = getUrgency(fu.daysSinceContact);
            return (
              <div key={fu.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fu.ownerName || 'Unknown'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[fu.responseStatus] || STATUS_STYLES.no_response}`}>
                        {STATUS_LABELS[fu.responseStatus] || fu.responseStatus}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${URGENCY_COLORS[urgency.color]}`}>
                        {urgency.label}
                      </span>
                    </div>
                    {fu.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-400"><i className="fas fa-phone mr-1"></i>{fu.phone}</p>
                    )}
                    {fu.propertyAddress && (
                      <p className="text-xs text-gray-500 mt-0.5"><i className="fas fa-map-marker-alt mr-1"></i>{fu.propertyAddress}</p>
                    )}
                    <p className="text-xs text-blue-600 mt-1.5 font-medium">
                      <i className="fas fa-lightbulb mr-1"></i>{fu.suggestedAction}
                    </p>
                    {fu.originalMessage && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        Last message: &ldquo;{fu.originalMessage.substring(0, 80)}{fu.originalMessage.length > 80 ? '...' : ''}&rdquo;
                      </p>
                    )}
                    {fu.lastResponse && (
                      <p className="text-xs text-green-600 mt-1">
                        <i className="fas fa-reply mr-1"></i>Response: &ldquo;{fu.lastResponse.substring(0, 80)}{fu.lastResponse.length > 80 ? '...' : ''}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => window.location.href = `/prototype/conversations?leadId=${fu.leadId}`}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <i className="fas fa-comments mr-1"></i>View
                    </button>
                    <button
                      onClick={() => window.location.href = '/prototype/campaigns'}
                      className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <i className="fas fa-paper-plane mr-1"></i>Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
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
