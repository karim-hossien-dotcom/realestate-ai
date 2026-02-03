'use client';

import { useState } from 'react';

export default function RunFollowupsButton() {
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [testToPhone, setTestToPhone] = useState('');
  const [buildBusy, setBuildBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  const buildFollowups = async () => {
    setBuildBusy(true);
    setBuildStatus('Building...');
    try {
      const res = await fetch('/api/followups/build', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBuildStatus(data?.error || 'Build follow-ups failed.');
      } else if (data?.demo) {
        setBuildStatus(data?.message || 'Demo mode.');
      } else {
        setBuildStatus('Follow-ups built.');
      }
    } catch {
      setBuildStatus('Build follow-ups failed.');
    } finally {
      setBuildBusy(false);
    }
  };

  const sendFollowups = async () => {
    setSendBusy(true);
    setSendStatus('Sending...');
    try {
      const res = await fetch('/api/followups/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testToPhone: testToPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendStatus(data?.error || 'Send follow-ups failed.');
      } else if (data?.demo) {
        setSendStatus(data?.message || 'Demo mode.');
      } else {
        setSendStatus('Follow-ups sent.');
      }
    } catch {
      setSendStatus('Send follow-ups failed.');
    } finally {
      setSendBusy(false);
    }
  };

  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={testToPhone}
          onChange={(event) => setTestToPhone(event.target.value)}
          placeholder="Test phone (optional)"
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={buildFollowups}
          disabled={buildBusy}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Build Follow-Ups
        </button>
        <button
          type="button"
          onClick={sendFollowups}
          disabled={sendBusy}
          className="rounded-md bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send Due
        </button>
        {buildStatus && <span className="text-gray-700">{buildStatus}</span>}
        {sendStatus && <span className="text-gray-700">{sendStatus}</span>}
      </div>
    </div>
  );
}
