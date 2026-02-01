'use client';

import { useState } from 'react';

export default function RunCalendarInvite() {
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendInvite = async () => {
    setBusy(true);
    setStatus('Sending...');
    try {
      const res = await fetch('/api/calendar/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadName,
          leadEmail,
          subject,
          description,
          startDateTime,
          durationMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || 'Send invite failed.');
      } else if (data?.demo) {
        setStatus(data?.message || 'Demo mode.');
      } else {
        setStatus('Invite sent.');
      }
    } catch (err) {
      setStatus('Send invite failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg bg-white/90 p-3 text-xs shadow-sm">
      <div className="mb-2 font-semibold text-gray-800">Send Calendar Invite</div>
      <div className="grid gap-2">
        <input
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Lead name"
          value={leadName}
          onChange={(event) => setLeadName(event.target.value)}
        />
        <input
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Lead email"
          value={leadEmail}
          onChange={(event) => setLeadEmail(event.target.value)}
        />
        <input
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
        <input
          className="w-56 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Start (YYYY-MM-DD HH:MM)"
          value={startDateTime}
          onChange={(event) => setStartDateTime(event.target.value)}
        />
        <input
          className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
          placeholder="Duration"
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(event.target.value)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={sendInvite}
          disabled={busy}
          className="rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send Invite
        </button>
        {status && <span className="text-gray-700">{status}</span>}
      </div>
    </div>
  );
}
