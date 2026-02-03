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
        setBasicStatus(data?.error || 'Step 1 failed.');
      } else if (data?.demo) {
        setBasicStatus(data?.message || 'Demo mode.');
      } else {
        setBasicStatus('Step 1 done.');
      }
    } catch (err) {
      setBasicStatus('Step 1 failed.');
    } finally {
      setBasicBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <span className="font-semibold text-gray-600">Listing Agent</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runListingAgentBasic}
          disabled={basicBusy || busy}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Step 1: Generate
        </button>
        <button
          type="button"
          onClick={runListingAgent}
          disabled={busy || basicBusy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Step 2: Enrich
        </button>
      </div>
      {basicStatus && <span className="text-gray-700">{basicStatus}</span>}
      {status && <span className="text-gray-700">{status}</span>}
    </div>
  );
}
