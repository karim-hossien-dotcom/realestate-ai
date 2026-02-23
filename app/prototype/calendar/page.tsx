'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/app/components/ToastProvider';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonCard } from '@/app/components/Skeleton';

type CalendarEvent = {
  id: string;
  date: string;
  time: string;
  type: 'meeting' | 'followup';
  phone: string;
  note: string;
  title?: string;
  property_address?: string;
  status?: string;
  source?: string;
};

type LeadOption = {
  id: string;
  name: string;
  phone: string;
  detail?: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(dateStr: string, timeStr?: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  const time = timeStr ? ` at ${timeStr}` : '';
  return `${month} ${day}${time}`;
}

function getGoogleCalendarUrl(event: CalendarEvent): string {
  const title = encodeURIComponent(event.title || `${event.type === 'meeting' ? 'Meeting' : 'Follow-up'} - ${event.phone}`);
  const details = encodeURIComponent(event.note || '');
  const location = encodeURIComponent(event.property_address || '');

  let startDate = event.date.replace(/-/g, '');
  let endDate = startDate;
  if (event.time) {
    const start = event.time.replace(':', '') + '00';
    const endHour = (parseInt(event.time.split(':')[0]) + 1).toString().padStart(2, '0');
    const end = endHour + event.time.split(':')[1] + '00';
    startDate += 'T' + start;
    endDate += 'T' + end;
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`;
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [leadTab, setLeadTab] = useState<'manual' | 'followups' | 'campaigns'>('manual');
  const [followUpLeads, setFollowUpLeads] = useState<LeadOption[]>([]);
  const [campaignLeads, setCampaignLeads] = useState<LeadOption[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ leadId: '', phone: '', date: '', time: '14:00', note: '' });
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/events');
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
      }
    } catch {
      showToast('Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const getEventsForDate = (dateStr: string) => events.filter(e => e.date === dateStr);

  // Stats
  const totalMeetings = events.filter(e => e.type === 'meeting').length;
  const followupsDue = events.filter(e => e.type === 'followup' && e.date >= todayStr).length;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const thisWeek = events.filter(e => e.date >= weekStartStr && e.date <= weekEndStr).length;
  const todayEvents = events.filter(e => e.date === todayStr).length;

  // Upcoming events (next 10 from today)
  const upcoming = events.filter(e => e.date >= todayStr).slice(0, 10);

  // Day events
  const dayEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Load leads for modal tabs
  const loadFollowUpLeads = async () => {
    if (followUpLeads.length > 0) return;
    setLeadsLoading(true);
    try {
      const res = await fetch('/api/followups');
      const data = await res.json();
      if (data.ok) {
        const leads: LeadOption[] = (data.followups || []).map((f: { leadId: string; ownerName?: string; phone?: string; propertyAddress?: string }) => ({
          id: f.leadId,
          name: f.ownerName || 'Unknown',
          phone: f.phone || '',
          detail: f.propertyAddress,
        }));
        setFollowUpLeads(leads);
      }
    } catch { /* ignore */ }
    setLeadsLoading(false);
  };

  const loadCampaignLeads = async () => {
    if (campaignLeads.length > 0) return;
    setLeadsLoading(true);
    try {
      const res = await fetch('/api/campaigns/leads');
      const data = await res.json();
      if (data.ok) {
        const leads: LeadOption[] = (data.leads || []).map((l: { id: string; owner_name?: string; phone?: string; property_address?: string }) => ({
          id: l.id,
          name: l.owner_name || 'Unknown',
          phone: l.phone || '',
          detail: l.property_address,
        }));
        setCampaignLeads(leads);
      }
    } catch { /* ignore */ }
    setLeadsLoading(false);
  };

  const selectLead = (lead: LeadOption) => {
    setInviteForm(prev => ({
      ...prev,
      leadId: lead.id,
      phone: lead.phone,
      note: lead.detail ? `Re: ${lead.detail}` : prev.note,
    }));
  };

  const handleSaveInvite = async () => {
    if (!inviteForm.leadId || !inviteForm.date || !inviteForm.time) {
      showToast('Please select a lead and fill in date/time', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/leads/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: inviteForm.leadId,
          action: 'schedule_meeting',
          date: inviteForm.date,
          time: inviteForm.time,
          note: inviteForm.note,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('Meeting scheduled!', 'success');
        setShowModal(false);
        setInviteForm({ leadId: '', phone: '', date: '', time: '14:00', note: '' });
        fetchEvents();

        // Open Google Calendar
        const newEvent: CalendarEvent = {
          id: 'new',
          date: inviteForm.date,
          time: inviteForm.time,
          type: 'meeting',
          phone: inviteForm.phone,
          note: inviteForm.note,
        };
        window.open(getGoogleCalendarUrl(newEvent), '_blank');
      } else {
        showToast(data.error || 'Failed to schedule', 'error');
      }
    } catch {
      showToast('Failed to schedule meeting', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setInviteForm(prev => ({
      ...prev,
      date: tomorrow.toISOString().split('T')[0],
    }));
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-gray-200 rounded-lg h-96 animate-pulse"></div>
      </div>
    );
  }

  // Build calendar grid cells
  const cells: Array<{ day: number; dateStr: string; isCurrentMonth: boolean; isToday: boolean; events: CalendarEvent[] }> = [];

  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isCurrentMonth: false, isToday: false, events: getEventsForDate(dateStr) });
  }

  // Current month
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = getDateStr(d);
    cells.push({ day: d, dateStr, isCurrentMonth: true, isToday: dateStr === todayStr, events: getEventsForDate(dateStr) });
  }

  // Next month padding
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr, isCurrentMonth: false, isToday: false, events: getEventsForDate(dateStr) });
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View and manage meetings & follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <i className="fas fa-plus mr-2"></i>Create Invite
          </button>
          <button
            onClick={() => { setLoading(true); fetchEvents(); }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm transition-colors"
            title="Refresh"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Meetings" value={totalMeetings} icon="fa-calendar-check" color="blue" />
        <StatCard label="Follow-ups Due" value={followupsDue} icon="fa-clock" color="yellow" />
        <StatCard label="This Week" value={thisWeek} icon="fa-calendar-week" color="green" />
        <StatCard label="Today" value={todayEvents} icon="fa-calendar-day" color="red" />
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <i className="fas fa-chevron-left text-gray-600"></i>
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={goToday} className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <i className="fas fa-chevron-right text-gray-600"></i>
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS.map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => (
              <button
                key={i}
                onClick={() => setSelectedDate(cell.isCurrentMonth ? cell.dateStr : null)}
                className={`relative p-2 min-h-[80px] border-b border-r border-gray-100 text-left transition-colors hover:bg-gray-50 ${
                  !cell.isCurrentMonth ? 'bg-gray-50/50' : ''
                } ${cell.isToday ? 'bg-blue-50' : ''} ${selectedDate === cell.dateStr ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
              >
                <span className={`text-sm ${
                  !cell.isCurrentMonth ? 'text-gray-300' : cell.isToday ? 'text-blue-600 font-bold' : 'text-gray-700'
                }`}>
                  {cell.day}
                </span>
                {cell.events.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cell.events.slice(0, 2).map(e => (
                      <span
                        key={e.id}
                        className={`block w-full text-[10px] px-1 py-0.5 rounded truncate ${
                          e.type === 'meeting' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {e.time && <span className="font-medium">{e.time} </span>}
                        {e.title || e.phone || e.type}
                      </span>
                    ))}
                    {cell.events.length > 2 && (
                      <span className="text-[10px] text-gray-400 px-1">+{cell.events.length - 2} more</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Upcoming Events */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selectedDate ? `Events on ${formatDate(selectedDate)}` : 'Upcoming Events'}
            </h3>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="text-xs text-blue-600 hover:underline mt-0.5">
                Show all upcoming
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {(selectedDate ? dayEvents : upcoming).length === 0 ? (
              <div className="p-8 text-center">
                <i className="fas fa-calendar text-gray-300 text-3xl mb-2"></i>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedDate ? 'No events on this day' : 'No upcoming events'}
                </p>
              </div>
            ) : (
              (selectedDate ? dayEvents : upcoming).map(event => (
                <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      event.type === 'meeting' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      <i className={`fas ${event.type === 'meeting' ? 'fa-handshake' : 'fa-clock'} text-sm`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {event.title || (event.type === 'meeting' ? 'Meeting' : 'Follow-up')}
                      </p>
                      {event.phone && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          <i className="fas fa-phone mr-1"></i>{event.phone}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        <i className="fas fa-calendar mr-1"></i>{formatDate(event.date, event.time)}
                      </p>
                      {event.property_address && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          <i className="fas fa-map-marker-alt mr-1"></i>{event.property_address}
                        </p>
                      )}
                      {event.note && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{event.note}</p>
                      )}
                      {event.source === 'ai_bot' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 mt-1">
                          <i className="fas fa-robot mr-1"></i>AI Bot
                        </span>
                      )}
                    </div>
                    <a
                      href={getGoogleCalendarUrl(event)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="Add to Google Calendar"
                    >
                      <i className="fab fa-google text-sm"></i>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create Meeting Invite</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Lead Selection Tabs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Lead</label>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {[
                    { key: 'manual' as const, label: 'Manual' },
                    { key: 'followups' as const, label: 'Follow-ups' },
                    { key: 'campaigns' as const, label: 'Campaigns' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setLeadTab(tab.key);
                        if (tab.key === 'followups') loadFollowUpLeads();
                        if (tab.key === 'campaigns') loadCampaignLeads();
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        leadTab === tab.key ? 'bg-white dark:bg-gray-800 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="mt-3">
                  {leadTab === 'manual' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Select a lead from Follow-ups or Campaigns tabs, or the lead will be matched by phone.</p>
                  )}
                  {leadTab !== 'manual' && (
                    <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                      {leadsLoading ? (
                        <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
                      ) : (leadTab === 'followups' ? followUpLeads : campaignLeads).length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-400">No leads available</div>
                      ) : (
                        (leadTab === 'followups' ? followUpLeads : campaignLeads).map(lead => (
                          <button
                            key={lead.id}
                            onClick={() => selectLead(lead)}
                            className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors ${
                              inviteForm.leadId === lead.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lead.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {lead.phone && <span className="mr-3"><i className="fas fa-phone mr-1"></i>{lead.phone}</span>}
                              {lead.detail && <span><i className="fas fa-map-marker-alt mr-1"></i>{lead.detail}</span>}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {inviteForm.leadId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <i className="fas fa-user-check"></i>
                  <span>Lead selected: {inviteForm.phone || inviteForm.leadId}</span>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={inviteForm.date}
                    onChange={e => setInviteForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={inviteForm.time}
                    onChange={e => setInviteForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea
                  value={inviteForm.note}
                  onChange={e => setInviteForm(prev => ({ ...prev, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meeting agenda or notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInvite}
                disabled={saving || !inviteForm.leadId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? 'Scheduling...' : 'Schedule & Add to Calendar'}
              </button>
            </div>
          </div>
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
