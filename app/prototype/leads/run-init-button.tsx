'use client';

import { useState } from 'react';

export default function RunInitLeadsButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runInit = async () => {
    setBusy(true);
    setStatus('Running...');
    try {
      const res = await fetch('/api/leads/init', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || 'Init leads failed.');
      } else {
        setStatus('Leads state initialized.');
      }
    } catch (err) {
      setStatus('Init leads failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
      <button
        type="button"
        onClick={runInit}
        disabled={busy}
        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Init Leads
      </button>
      {status && <span className="text-gray-700">{status}</span>}
    </div>
  );
}
