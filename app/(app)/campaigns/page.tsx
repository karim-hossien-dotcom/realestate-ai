'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/app/components/ToastProvider';
import StatusBadge from '@/app/components/StatusBadge';
import ScoreBadge from '@/app/components/ScoreBadge';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonTable } from '@/app/components/Skeleton';
import { type CampaignTemplate, CAMPAIGN_TEMPLATES, fillTemplate } from '@/app/lib/messaging/campaign-templates';

type CampaignLead = {
  id: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  property_address: string | null;
  sms_text: string | null;
  score: number;
  score_category: string;
  last_contacted: string | null;
};

type SendResult = {
  phone?: string;
  contact?: string;
  ok: boolean;
  channel: string;
  skipped?: string;
  error?: string;
};

type CampaignRecord = {
  id: string;
  name: string;
  status: string;
  total_leads: number;
  sent_count: number | null;
  failed_count: number | null;
  response_count: number | null;
  created_at: string;
  completed_at: string | null;
};

export default function CampaignsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-secondary)]">Loading campaigns...</div>}>
      <CampaignsPage />
    </Suspense>
  );
}

function CampaignsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'sms' | 'both'>('whatsapp');
  const [campaignName, setCampaignName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [sendStats, setSendStats] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilters, setScoreFilters] = useState<Set<string>>(new Set());
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [hideContacted, setHideContacted] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'address'>('score');
  const [campaignHistory, setCampaignHistory] = useState<CampaignRecord[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [customTemplates, setCustomTemplates] = useState<Array<{ id: string; name: string; sms_body: string; email_subject?: string; email_body?: string; tags?: string[]; category: string; is_favorite: boolean; use_count: number }>>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

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

  const fetchCampaignHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.ok) setCampaignHistory(data.campaigns || []);
    } catch { /* silent */ }
  }, []);

  const fetchCustomTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns/templates/custom');
      const data = await res.json();
      if (data.ok) setCustomTemplates(data.templates || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchCampaignHistory();
    fetchCustomTemplates();
  }, [fetchLeads, fetchCampaignHistory, fetchCustomTemplates]);

  // Auto-select template from URL params (e.g. ?template=commercial-prospecting from onboarding)
  useEffect(() => {
    const templateId = searchParams.get('template');
    if (!templateId) return;
    const match = CAMPAIGN_TEMPLATES.find(t => t.id === templateId);
    if (match) {
      setSelectedTemplate(match);
      const preview = channel === 'email' ? match.emailBody : match.smsBody;
      setCustomMessage(fillTemplate(preview, {
        firstName: 'there',
        address: 'your property',
        area: 'your area',
      }));
      setStep(2);
    }
  }, [searchParams, channel]);

  const toggleScoreFilter = (category: string) => {
    setScoreFilters(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  const filteredLeads = leads
    .filter((lead) => {
      if (scoreFilters.size > 0 && !scoreFilters.has(lead.score_category)) return false;
      if (hasPhoneOnly && !lead.phone) return false;
      if (hasEmailOnly && !lead.email) return false;
      if (hideContacted && lead.last_contacted) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (lead.owner_name || '').toLowerCase().includes(q) ||
          (lead.phone || '').includes(q) ||
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
        case 'address':
          return (a.property_address || '').localeCompare(b.property_address || '');
        default:
          return 0;
      }
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

    const channelsToSend: ('whatsapp' | 'email' | 'sms')[] =
      channel === 'both' ? ['whatsapp', 'email', 'sms'] : [channel];

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
            campaignName: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
            messageTemplate: selectedTemplate
              ? (ch === 'email' ? selectedTemplate.emailBody : selectedTemplate.smsBody)
              : customMessage || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error === 'no_subscription'
            ? 'No active subscription. Please subscribe to a plan first.'
            : data.error === 'feature_blocked'
              ? data.message
              : data.error === 'limit_exceeded'
                ? data.message
                : data.message || data.error || `Failed to send ${ch} campaign`;
          showToast(errMsg, 'error');
          totalFailed += selectedLeads.length;
          continue;
        }
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
    fetchCampaignHistory();

    if (totalSent > 0) {
      showToast(`Campaign sent: ${totalSent} delivered`, 'success');
    } else {
      showToast('Campaign send completed with issues', 'warning');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-[var(--surface-elevated)] rounded w-48 animate-pulse"></div>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300">
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
        <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Campaigns</h1>
        <p className="text-sm text-[var(--text-secondary)]">Send outreach messages to your leads via WhatsApp, SMS, or Email</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Select Audience' },
          { num: 2, label: 'Configure Content' },
          { num: 3, label: 'Review & Send' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${step >= s.num ? 'bg-blue-600' : 'bg-[var(--border)]'}`}></div>}
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
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]'
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

          {/* Filter Bar */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

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

              {/* Contact toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHasPhoneOnly(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                    hasPhoneOnly
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <i className="fas fa-phone text-[10px]"></i>Has Phone
                </button>
                <button
                  onClick={() => setHasEmailOnly(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                    hasEmailOnly
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <i className="fas fa-envelope text-[10px]"></i>Has Email
                </button>
                <button
                  onClick={() => setHideContacted(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                    hideContacted
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <i className="fas fa-user-clock text-[10px]"></i>Not Yet Contacted
                </button>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-[var(--text-secondary)]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="px-2 py-1 border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] rounded-md text-xs focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="score">Score (High to Low)</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="address">Address</option>
                </select>
              </div>
            </div>

            {/* Active filter summary */}
            {(scoreFilters.size > 0 || hasPhoneOnly || hasEmailOnly) && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>Showing {filteredLeads.length} of {leads.length} leads</span>
                <button
                  onClick={() => { setScoreFilters(new Set()); setHasPhoneOnly(false); setHasEmailOnly(false); }}
                  className="text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {filteredLeads.length === 0 ? (
            <EmptyState
              icon="fa-bullhorn"
              title="No Leads Ready"
              description="Leads need generated messages before they can be included in campaigns. Go to Leads and run the message generation pipeline."
            />
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase hidden md:table-cell">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Score</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase hidden lg:table-cell">Message Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-elevated)]">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={(e) => toggleSelect(lead.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{lead.owner_name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{lead.phone || '—'}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)] hidden md:table-cell truncate max-w-[200px]">{lead.property_address || '—'}</td>
                        <td className="px-4 py-3"><ScoreBadge score={lead.score} category={lead.score_category} /></td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)] hidden lg:table-cell truncate max-w-[250px]">{lead.sms_text || '—'}</td>
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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 space-y-5">
            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={`Campaign ${new Date().toLocaleDateString()}`}
                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Channel */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Channel</label>
              <div className="flex gap-3">
                {[
                  { value: 'whatsapp', label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: 'green' },
                  { value: 'sms', label: 'SMS', icon: 'fa-sms', color: 'cyan' },
                  { value: 'email', label: 'Email', icon: 'fa-envelope', color: 'blue' },
                  { value: 'both', label: 'All', icon: 'fa-paper-plane', color: 'purple' },
                ].map((ch) => (
                  <button
                    key={ch.value}
                    onClick={() => setChannel(ch.value as typeof channel)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                      channel === ch.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <i className={`fas ${ch.icon}`}></i>
                    {ch.label}
                  </button>
                ))}
              </div>
              {channel === 'both' && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <i className="fas fa-exclamation-triangle text-amber-500 mt-0.5 text-sm flex-shrink-0"></i>
                  <p className="text-sm text-amber-400">
                    This will send 3 separate messages per lead (WhatsApp + SMS + Email), using 3x your message quota.
                  </p>
                </div>
              )}
            </div>

            {/* Template Picker */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Message Template</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                <button
                  onClick={() => { setSelectedTemplate(null); setCustomMessage(''); }}
                  className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                    !selectedTemplate
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-secondary)]'
                  }`}
                >
                  <div className="font-semibold text-[var(--text-primary)]">AI Auto-Generate</div>
                  <div className="text-[var(--text-secondary)] mt-0.5">AI personalizes per lead</div>
                </button>
                {/* Custom templates first */}
                {customTemplates.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => {
                      setSelectedTemplate({ id: ct.id, name: ct.name, category: 'custom' as CampaignTemplate['category'], description: '', smsBody: ct.sms_body, emailSubject: ct.email_subject || '', emailBody: ct.email_body || '', tags: ct.tags || ['custom'], bestFor: '' });
                      const firstLead = selectedLeads[0];
                      const preview = channel === 'email' && ct.email_body ? ct.email_body : ct.sms_body;
                      setCustomMessage(fillTemplate(preview, {
                        firstName: firstLead?.owner_name?.split(' ')[0] || 'there',
                        address: firstLead?.property_address || 'your property',
                        area: firstLead?.property_address?.split(',')[1]?.trim() || 'your area',
                      }));
                    }}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer relative ${
                      selectedTemplate?.id === ct.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                    }`}
                  >
                    {ct.is_favorite && <span className="absolute top-1.5 right-1.5 text-amber-400 text-[10px]"><i className="fas fa-star"></i></span>}
                    <div className="font-semibold text-[var(--text-primary)]">{ct.name}</div>
                    <div className="text-purple-400 mt-0.5">Your template</div>
                  </button>
                ))}
                {/* Built-in templates */}
                {CAMPAIGN_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplate(t);
                      const firstLead = selectedLeads[0];
                      const preview = channel === 'email' ? t.emailBody : t.smsBody;
                      setCustomMessage(fillTemplate(preview, {
                        firstName: firstLead?.owner_name?.split(' ')[0] || 'there',
                        address: firstLead?.property_address || 'your property',
                        area: firstLead?.property_address?.split(',')[1]?.trim() || 'your area',
                      }));
                    }}
                    className={`p-3 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      selectedTemplate?.id === t.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{t.name}</div>
                    <div className="text-[var(--text-secondary)] mt-0.5 line-clamp-2">{t.bestFor}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Preview / Editor */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                {selectedTemplate ? 'Message Preview (editable)' : 'Message Preview'}
              </label>
              {selectedTemplate ? (
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  rows={channel === 'email' ? 12 : 4}
                  className="w-full px-3 py-2.5 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-y"
                  placeholder="Edit your message..."
                />
              ) : (
                <div className="bg-[var(--surface-elevated)] rounded-lg p-4 text-sm text-[var(--text-secondary)] border border-[var(--border)]">
                  AI will auto-generate a personalized message for each lead based on their property, intent, and context.
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                {selectedTemplate && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)]">Template: {selectedTemplate.name}</span>
                    <span className="text-[11px] text-[var(--text-secondary)]">|</span>
                    {selectedTemplate.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] text-[var(--text-secondary)]">{tag}</span>
                    ))}
                  </div>
                )}
                {customMessage && (
                  <button
                    onClick={() => setShowSaveTemplate(true)}
                    className="ml-auto text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1"
                  >
                    <i className="fas fa-save text-[10px]"></i> Save as Template
                  </button>
                )}
              </div>

              {/* Save as Template Dialog */}
              {showSaveTemplate && (
                <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg p-4 space-y-3 mt-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Save as Custom Template</p>
                  <input
                    type="text"
                    value={saveTemplateName}
                    onChange={e => setSaveTemplateName(e.target.value)}
                    placeholder="Template name (e.g., My Follow-Up Script)"
                    className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!saveTemplateName.trim() || savingTemplate}
                      onClick={async () => {
                        setSavingTemplate(true);
                        try {
                          const res = await fetch('/api/campaigns/templates/custom', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              name: saveTemplateName.trim(),
                              sms_body: customMessage,
                              email_subject: selectedTemplate?.emailSubject || '',
                              email_body: channel === 'email' ? customMessage : '',
                              tags: ['custom'],
                            }),
                          });
                          const data = await res.json();
                          if (data.ok) {
                            showToast('Template saved!', 'success');
                            setShowSaveTemplate(false);
                            setSaveTemplateName('');
                            fetchCustomTemplates();
                          } else {
                            showToast(data.error || data.message || 'Failed to save', 'error');
                          }
                        } catch {
                          showToast('Failed to save template', 'error');
                        } finally {
                          setSavingTemplate(false);
                        }
                      }}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {savingTemplate ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setShowSaveTemplate(false); setSaveTemplateName(''); }}
                      className="px-4 py-1.5 text-[var(--text-secondary)] text-sm cursor-pointer hover:text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium"
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
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Campaign Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase">Audience</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{selectedIds.size} leads</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase">Channel</p>
                <p className="text-xl font-bold text-[var(--text-primary)] capitalize">{channel}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase">Campaign</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{campaignName || 'Auto-named'}</p>
              </div>
            </div>
          </div>

          {/* Send Button / Progress / Results */}
          {!sendStats ? (
            <div className="text-center">
              {sending ? (
                <div className="py-8">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm text-[var(--text-secondary)]">Sending campaign... This may take a few minutes.</p>
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center dark:bg-green-500/10 dark:border-green-500/30">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{sendStats.sent}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 uppercase">Sent</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center dark:bg-red-500/10 dark:border-red-500/30">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{sendStats.failed}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 uppercase">Failed</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center dark:bg-yellow-500/10 dark:border-yellow-500/30">
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{sendStats.skipped}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 uppercase">Skipped</p>
                </div>
              </div>

              {/* Results table */}
              {sendResults.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full">
                      <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border)] sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Contact</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Channel</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sendResults.map((r, i) => (
                          <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--surface-elevated)]">
                            <td className="px-4 py-2 text-sm text-[var(--text-primary)]">{r.contact || r.phone}</td>
                            <td className="px-4 py-2 text-sm text-[var(--text-secondary)] capitalize">{r.channel}</td>
                            <td className="px-4 py-2">
                              {r.ok ? (
                                <span className="text-green-600 text-xs font-medium"><i className="fas fa-check-circle mr-1"></i>Sent</span>
                              ) : r.skipped ? (
                                <span className="text-yellow-600 text-xs font-medium"><i className="fas fa-forward mr-1"></i>Skipped</span>
                              ) : (
                                <span className="text-red-600 text-xs font-medium"><i className="fas fa-times-circle mr-1"></i>Failed</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-[var(--text-secondary)]">{r.skipped || r.error || '—'}</td>
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
                  className="px-4 py-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg text-sm font-medium transition-colors"
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
                className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm font-medium"
              >
                <i className="fas fa-arrow-left mr-2"></i>Back
              </button>
            </div>
          )}
        </div>
      )}

      {/* Campaign History */}
      {campaignHistory.length > 0 && (
        <div className="mt-8 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)]">Campaign History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-elevated)]">
                <tr>
                  <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Status</th>
                  <th className="text-right px-4 py-3 text-[var(--text-secondary)] font-medium">Sent</th>
                  <th className="text-right px-4 py-3 text-[var(--text-secondary)] font-medium">Failed</th>
                  <th className="text-left px-4 py-3 text-[var(--text-secondary)] font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {campaignHistory.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-primary)]">{c.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        c.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        c.status === 'sending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-primary)]">{c.sent_count ?? 0}</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">{c.failed_count ?? 0}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30' : 'bg-[var(--surface)] border-[var(--border)]'}`}>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className={`text-xl font-bold ${highlight ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-primary)]'}`}>{value}</p>
    </div>
  );
}
