'use client';

import { useState } from 'react';

export default function RunListingAgentButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [basicStatus, setBasicStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [basicBusy, setBasicBusy] = useState(false);

  const runListingAgent = async () => {
    setBusy(true);
    setStatus('Running...');
    try {
      const res = await fetch('/api/listing-agent/run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || 'Listing agent failed.');
      } else if (data?.demo) {
        setStatus(data?.message || 'Demo mode.');
      } else {
        setStatus('Listing agent completed.');
      }
    } catch (err) {
      setStatus('Listing agent failed.');
    } finally {
      setBusy(false);
    }
  };

  const runListingAgentBasic = async () => {
    setBasicBusy(true);
    setBasicStatus('Running...');
    try {
      const res = await fetch('/api/listing-agent/basic-run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBasicStatus(data?.error || 'Listing agent (basic) failed.');
      } else if (data?.demo) {
        setBasicStatus(data?.message || 'Demo mode.');
      } else {
        setBasicStatus('Listing agent (basic) completed.');
      }
    } catch (err) {
      setBasicStatus('Listing agent (basic) failed.');
    } finally {
      setBasicBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
      <button
        type="button"
        onClick={runListingAgentBasic}
        disabled={basicBusy}
        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Run Listing Agent (Basic)
      </button>
      <button
        type="button"
        onClick={runListingAgent}
        disabled={busy}
        className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Run Listing Agent
      </button>
      {basicStatus && <span className="text-gray-700">{basicStatus}</span>}
      {status && <span className="text-gray-700">{status}</span>}
    </div>
  );
}
