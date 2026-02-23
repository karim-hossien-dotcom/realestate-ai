'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import StatusBadge from '@/app/components/StatusBadge';
import ScoreBadge from '@/app/components/ScoreBadge';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonTable } from '@/app/components/Skeleton';

type CampaignLead = {
  id: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  property_address: string | null;
  sms_text: string | null;
  score: number;
  score_category: string;
};

type SendResult = {
  contact: string;
  ok: boolean;
  channel: string;
  skipped?: string;
  error?: string;
};

export default function CampaignsPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'both'>('whatsapp');
  const [templateName, setTemplateName] = useState('realestate_outreach');
  const [campaignName, setCampaignName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendStats, setSendStats] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns/leads');
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads || []);
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

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (lead.owner_name || '').toLowerCase().includes(q) ||
      (lead.phone || '').includes(q) ||
      (lead.property_address || '').toLowerCase().includes(q)
    );
  });

  const selectedLeads = leads.filter(l => selectedIds.has(l.id));
  const selectedWithPhone = selectedLeads.filter(l => l.phone).length;
  const selectedWithEmail = selectedLeads.filter(l => l.email).length;

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

  const handleSend = async () => {
    if (selectedLeads.length === 0) return;
    setSending(true);
    setSendResults([]);
    setSendStats(null);

    const channelsToSend: ('whatsapp' | 'email')[] =
      channel === 'both' ? ['whatsapp', 'email'] : [channel];

    const allResults: SendResult[] = [];
    let totalSent = 0, totalFailed = 0, totalSkipped = 0;

    for (const ch of channelsToSend) {
      try {
        const res = await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leads: selectedLeads,
            channel: ch,
            templateName: ch === 'whatsapp' ? templateName : undefined,
            campaignName: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
          }),
        });
        const data = await res.json();
        if (data.results) {
          allResults.push(...data.results.map((r: SendResult) => ({ ...r, channel: ch })));
        }
        totalSent += data.sent || 0;
        totalFailed += data.failed || 0;
        totalSkipped += data.skipped || 0;
      } catch {
        showToast(`Failed to send ${ch} campaign`, 'error');
        totalFailed += selectedLeads.length;
      }
    }

    setSendResults(allResults);
    setSendStats({ sent: totalSent, failed: totalFailed, skipped: totalSkipped });
    setSending(false);

    if (totalSent > 0) {
      showToast(`Campaign sent: ${totalSent} delivered`, 'success');
    } else {
      showToast('Campaign send completed with issues', 'warning');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Campaigns</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Send outreach messages to your leads via WhatsApp or Email</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Select Audience' },
          { num: 2, label: 'Configure Content' },
          { num: 3, label: 'Review & Send' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${step >= s.num ? 'bg-blue-600' : 'bg-gray-300'}`}></div>}
            <button
              onClick={() => {
                if (s.num === 1) setStep(1);
                else if (s.num === 2 && selectedIds.size > 0) setStep(2);
                else if (s.num === 3 && selectedIds.size > 0) setStep(3);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                step === s.num
                  ? 'bg-blue-600 text-white'
                  : step > s.num
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-white/20">
                {step > s.num ? <i className="fas fa-check text-xs"></i> : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Step 1: Audience */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Total Leads" value={leads.length} />
            <MiniStat label="Selected" value={selectedIds.size} highlight />
            <MiniStat label="With Phone" value={selectedWithPhone} />
            <MiniStat label="With Email" value={selectedWithEmail} />
          </div>

          {/* Search */}
          <div className="relative max-w-xs">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState
              icon="fa-bullhorn"
              title="No Leads Ready"
              description="Leads need generated messages before they can be included in campaigns. Go to Leads and run the message generation pipeline."
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Message Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50 dark:bg-gray-900">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={(e) => toggleSelect(lead.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{lead.owner_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{lead.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell truncate max-w-[200px]">{lead.property_address || '—'}</td>
                        <td className="px-4 py-3"><ScoreBadge score={lead.score} category={lead.score_category} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell truncate max-w-[250px]">{lead.sms_text || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={selectedIds.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              Next: Configure Content <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Content */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-5">
            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`Campaign ${new Date().toLocaleDateString()}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Channel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
              <div className="flex gap-3">
                {[
                  { value: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: 'green' },
                  { value: 'email', label: 'Email', icon: 'fa-envelope', color: 'blue' },
                  { value: 'both', label: 'Both', icon: 'fa-paper-plane', color: 'purple' },
                ].map((ch) => (
                  <button
                    key={ch.value}
                    onClick={() => setChannel(ch.value as typeof channel)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      channel === ch.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white dark:bg-gray-800 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <i className={`fas ${ch.icon}`}></i>
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Template */}
            {(channel === 'whatsapp' || channel === 'both') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Template</label>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="realestate_outreach">Real Estate Outreach</option>
                  <option value="hello_world">Hello World (Test)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Template must be approved in Meta Business Manager</p>
              </div>
            )}

            {/* Message Preview */}
            {selectedLeads[0]?.sms_text && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Preview (first lead)</label>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 border border-gray-200 dark:border-gray-700">
                  {selectedLeads[0].sms_text}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-100 text-sm font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Next: Review & Send <i className="fas fa-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Send */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Campaign Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Audience</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedIds.size} leads</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Channel</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">{channel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Template</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{templateName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Campaign</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{campaignName || 'Auto-named'}</p>
              </div>
            </div>
          </div>

          {/* Send Button / Progress / Results */}
          {!sendStats ? (
            <div className="text-center">
              {sending ? (
                <div className="py-8">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm text-gray-600">Sending campaign... This may take a few minutes.</p>
                </div>
              ) : (
                <button
                  onClick={handleSend}
                  className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-base font-semibold transition-colors shadow-sm"
                >
                  <i className="fas fa-paper-plane mr-2"></i>Send Campaign Now
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Results stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{sendStats.sent}</p>
                  <p className="text-xs text-green-600 uppercase">Sent</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{sendStats.failed}</p>
                  <p className="text-xs text-red-600 uppercase">Failed</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{sendStats.skipped}</p>
                  <p className="text-xs text-yellow-600 uppercase">Skipped</p>
                </div>
              </div>

              {/* Results table */}
              {sendResults.length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendResults.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{r.contact}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 capitalize">{r.channel}</td>
                            <td className="px-4 py-2">
                              {r.ok ? (
                                <span className="text-green-600 text-xs font-medium"><i className="fas fa-check-circle mr-1"></i>Sent</span>
                              ) : r.skipped ? (
                                <span className="text-yellow-600 text-xs font-medium"><i className="fas fa-forward mr-1"></i>Skipped</span>
                              ) : (
                                <span className="text-red-600 text-xs font-medium"><i className="fas fa-times-circle mr-1"></i>Failed</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{r.skipped || r.error || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* New Campaign button */}
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setStep(1);
                    setSelectedIds(new Set());
                    setSendResults([]);
                    setSendStats(null);
                    setCampaignName('');
                  }}
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
                >
                  <i className="fas fa-plus mr-2"></i>Create Another Campaign
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {!sendStats && !sending && (
            <div className="flex justify-start">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-100 text-sm font-medium"
              >
                <i className="fas fa-arrow-left mr-2"></i>Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white dark:bg-gray-800 border-gray-200'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-blue-700' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    </div>
  );
}
