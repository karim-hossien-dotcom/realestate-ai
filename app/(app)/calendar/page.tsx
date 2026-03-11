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
  latitude?: number;
  longitude?: number;
  travel_buffer_minutes?: number;
};

type TravelInfo = {
  from_id: string;
  to_id: string;
  travel_minutes: number | null;
  travel_text: string;
  has_conflict: boolean;
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

function downloadIcsFile(event: CalendarEvent): void {
  const title = event.title || `${event.type === 'meeting' ? 'Meeting' : 'Follow-up'} - ${event.phone}`;
  const description = event.note || '';
  const location = event.property_address || '';

  // Build start/end datetime strings (YYYYMMDDTHHMMSS)
  const dateClean = event.date.replace(/-/g, '');
  let dtStart = dateClean;
  let dtEnd = dateClean;
  if (event.time) {
    const [h, m] = event.time.split(':');
    dtStart = `${dateClean}T${h}${m}00`;
    const endHour = (parseInt(h) + 1).toString().padStart(2, '0');
    dtEnd = `${dateClean}T${endHour}${m}00`;
  }

  const uid = `${event.id}-${Date.now()}@estateai`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Estate AI//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const [travelInfos, setTravelInfos] = useState<TravelInfo[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

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

  // Check availability for a proposed meeting
  const checkAvailability = async (date: string, time: string, address: string) => {
    if (!address) return;
    setCheckingAvailability(true);
    try {
      const res = await fetch('/api/calendar/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_date: date,
          proposed_time: time,
          property_address: address,
          duration_minutes: 30,
          travel_buffer_minutes: 30,
        }),
      });
      const data = await res.json();
      if (data.ok && !data.available) {
        const conflictNames = data.conflicts.map((c: { meeting_title: string; meeting_time: string; travel_time_minutes: number | null }) =>
          `${c.meeting_title} at ${c.meeting_time}${c.travel_time_minutes ? ` (${c.travel_time_minutes}min drive)` : ''}`
        ).join(', ');
        showToast(`Scheduling conflict: ${conflictNames}${data.suggested_times?.length ? `. Try: ${data.suggested_times.join(', ')}` : ''}`, 'warning');
      }
    } catch {
      // Silently fail — availability check is best-effort
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Compute travel info between consecutive day events
  const computedTravelInfos = (() => {
    if (!selectedDate) return [];
    const sorted = [...dayEvents]
      .filter(e => e.time && e.property_address)
      .sort((a, b) => a.time.localeCompare(b.time));
    const infos: TravelInfo[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (curr.property_address && next.property_address) {
        // Estimate gap in minutes
        const [ch, cm] = curr.time.split(':').map(Number);
        const [nh, nm] = next.time.split(':').map(Number);
        const gap = (nh * 60 + nm) - (ch * 60 + cm) - 30; // subtract meeting duration
        infos.push({
          from_id: curr.id,
          to_id: next.id,
          travel_minutes: null, // Could be populated by API call
          travel_text: gap < 30 ? 'Tight schedule' : `${gap}min gap`,
          has_conflict: gap < 30,
        });
      }
    }
    return infos;
  })();

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

        // Offer calendar options
        const newEvent: CalendarEvent = {
          id: 'new-' + Date.now(),
          date: inviteForm.date,
          time: inviteForm.time,
          type: 'meeting',
          phone: inviteForm.phone,
          note: inviteForm.note,
        };
        const choice = window.confirm('Add to Google Calendar?\n\nOK = Google Calendar\nCancel = Download .ics (Apple Calendar / Outlook)');
        if (choice) {
          window.open(getGoogleCalendarUrl(newEvent), '_blank');
        } else {
          downloadIcsFile(newEvent);
        }
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
        <div className="h-8 bg-[var(--surface-elevated)] rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="bg-[var(--surface-elevated)] rounded-lg h-96 animate-pulse"></div>
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
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Calendar</h1>
          <p className="text-sm text-[var(--text-secondary)]">View and manage meetings & follow-ups</p>
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
            className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-elevated)] dark:hover:bg-[var(--surface-elevated)] text-sm transition-colors"
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
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <button onClick={prevMonth} className="p-2 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors">
              <i className="fas fa-chevron-left text-[var(--text-secondary)]"></i>
            </button>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {MONTHS[month]} {year}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={goToday} className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                Today
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors">
                <i className="fas fa-chevron-right text-[var(--text-secondary)]"></i>
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {DAYS.map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">
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
                className={`relative p-2 min-h-[80px] border-b border-r border-[var(--border)] text-left transition-colors hover:bg-[var(--surface-elevated)] ${
                  !cell.isCurrentMonth ? 'bg-[var(--surface-elevated)]/50' : ''
                } ${cell.isToday ? 'bg-blue-50 dark:bg-blue-500/10' : ''} ${selectedDate === cell.dateStr ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
              >
                <span className={`text-sm ${
                  !cell.isCurrentMonth ? 'text-[var(--text-secondary)] opacity-50' : cell.isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-[var(--text-primary)]'
                }`}>
                  {cell.day}
                </span>
                {cell.events.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {cell.events.slice(0, 2).map(e => (
                      <span
                        key={e.id}
                        className={`block w-full text-[10px] px-1 py-0.5 rounded truncate ${
                          e.type === 'meeting'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300'
                        }`}
                      >
                        {e.time && <span className="font-medium">{e.time} </span>}
                        {e.title || e.phone || e.type}
                      </span>
                    ))}
                    {cell.events.length > 2 && (
                      <span className="text-[10px] text-[var(--text-secondary)] px-1">+{cell.events.length - 2} more</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Upcoming Events */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {selectedDate ? `Events on ${formatDate(selectedDate)}` : 'Upcoming Events'}
            </h3>
            {selectedDate && (
              <button onClick={() => setSelectedDate(null)} className="text-xs text-blue-600 hover:underline mt-0.5">
                Show all upcoming
              </button>
            )}
          </div>
          <div className="divide-y divide-[var(--border)] max-h-[600px] overflow-y-auto">
            {(selectedDate ? dayEvents : upcoming).length === 0 ? (
              <div className="p-8 text-center">
                <i className="fas fa-calendar text-[var(--text-secondary)] text-3xl mb-2"></i>
                <p className="text-sm text-[var(--text-secondary)]">
                  {selectedDate ? 'No events on this day' : 'No upcoming events'}
                </p>
              </div>
            ) : (
              (selectedDate ? dayEvents : upcoming).map(event => (
                <div key={event.id} className="p-4 hover:bg-[var(--surface-elevated)] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      event.type === 'meeting'
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                        : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-300'
                    }`}>
                      <i className={`fas ${event.type === 'meeting' ? 'fa-handshake' : 'fa-clock'} text-sm`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {event.title || (event.type === 'meeting' ? 'Meeting' : 'Follow-up')}
                      </p>
                      {event.phone && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          <i className="fas fa-phone mr-1"></i>{event.phone}
                        </p>
                      )}
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        <i className="fas fa-calendar mr-1"></i>{formatDate(event.date, event.time)}
                      </p>
                      {event.property_address && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          <i className="fas fa-map-marker-alt mr-1"></i>{event.property_address}
                        </p>
                      )}
                      {event.note && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">{event.note}</p>
                      )}
                      {event.source === 'ai_bot' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 mt-1">
                          <i className="fas fa-robot mr-1"></i>AI Bot
                        </span>
                      )}
                      {/* Travel time indicator */}
                      {selectedDate && (() => {
                        const travel = computedTravelInfos.find(t => t.from_id === event.id);
                        if (!travel) return null;
                        return (
                          <div className={`flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] ${
                            travel.has_conflict
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300'
                          }`}>
                            <i className={`fas ${travel.has_conflict ? 'fa-exclamation-triangle' : 'fa-car'}`}></i>
                            <span>{travel.travel_text} to next</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <a
                        href={getGoogleCalendarUrl(event)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Add to Google Calendar"
                      >
                        <i className="fab fa-google text-sm"></i>
                      </a>
                      <button
                        onClick={() => downloadIcsFile(event)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        title="Add to Apple Calendar"
                      >
                        <i className="fab fa-apple text-sm"></i>
                      </button>
                    </div>
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
          <div className="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Create Meeting Invite</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Lead Selection Tabs */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Select Lead</label>
                <div className="flex gap-1 bg-[var(--surface-elevated)] rounded-lg p-1">
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
                        leadTab === tab.key
                          ? 'bg-[var(--surface)] shadow text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="mt-3">
                  {leadTab === 'manual' && (
                    <p className="text-xs text-[var(--text-secondary)]">Select a lead from Follow-ups or Campaigns tabs, or the lead will be matched by phone.</p>
                  )}
                  {leadTab !== 'manual' && (
                    <div className="border border-[var(--border)] rounded-lg max-h-48 overflow-y-auto">
                      {leadsLoading ? (
                        <div className="p-4 text-center text-sm text-[var(--text-secondary)]">Loading...</div>
                      ) : (leadTab === 'followups' ? followUpLeads : campaignLeads).length === 0 ? (
                        <div className="p-4 text-center text-sm text-[var(--text-secondary)]">No leads available</div>
                      ) : (
                        (leadTab === 'followups' ? followUpLeads : campaignLeads).map(lead => (
                          <button
                            key={lead.id}
                            onClick={() => selectLead(lead)}
                            className={`w-full text-left px-4 py-2.5 hover:bg-[var(--surface-elevated)] border-b border-[var(--border)] last:border-0 transition-colors ${
                              inviteForm.leadId === lead.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                            }`}
                          >
                            <p className="text-sm font-medium text-[var(--text-primary)]">{lead.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">
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
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                  <i className="fas fa-user-check"></i>
                  <span>Lead selected: {inviteForm.phone || inviteForm.leadId}</span>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Date</label>
                  <input
                    type="date"
                    value={inviteForm.date}
                    onChange={e => setInviteForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Time</label>
                  <input
                    type="time"
                    value={inviteForm.time}
                    onChange={e => setInviteForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Property Address for travel check */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Property Address (optional — enables travel conflict check)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteForm.note.startsWith('Re: ') ? inviteForm.note.slice(4) : ''}
                    readOnly
                    placeholder="Auto-filled from lead selection"
                    className="flex-1 px-3 py-2 border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-secondary)] rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const addr = inviteForm.note.startsWith('Re: ') ? inviteForm.note.slice(4) : '';
                      if (addr && inviteForm.date && inviteForm.time) {
                        checkAvailability(inviteForm.date, inviteForm.time, addr);
                      } else {
                        showToast('Need date, time, and address to check', 'warning');
                      }
                    }}
                    disabled={checkingAvailability}
                    className="px-3 py-2 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-elevated)] transition-colors disabled:opacity-50"
                    title="Check for travel conflicts"
                  >
                    {checkingAvailability ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-route"></i>}
                  </button>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Note (optional)</label>
                <textarea
                  value={inviteForm.note}
                  onChange={e => setInviteForm(prev => ({ ...prev, note: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meeting agenda or notes..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-lg transition-colors"
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
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    green: 'bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-300',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
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
