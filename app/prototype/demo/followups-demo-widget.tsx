'use client';

import { useState } from 'react';

export default function FollowupsDemoWidget() {
  const [status, setStatus] = useState<string | null>(null);
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  const runBuild = async () => {
    setBusy(true);
    setStatus('Running...');
    setResponse(null);
    try {
      const res = await fetch('/api/followups/build', { method: 'POST' });
      const data = await res.json();
      setResponse(data);
      if (!res.ok) {
        setStatus(data?.error || 'Build follow-ups failed.');
      } else {
        setStatus(data?.message || 'Done.');
      }
    } catch (err) {
      setStatus('Build follow-ups failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
      <div className="font-semibold text-gray-900">Follow-Ups Demo Widget</div>
      <div className="mt-2 text-xs text-gray-600">
        Calls <span className="font-mono">/api/followups/build</span> and shows the response.
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={runBuild}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Build
        </button>
        {status && <span className="text-gray-700">{status}</span>}
      </div>
      {response && (
        <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-gray-900 p-3 text-[11px] text-gray-100">
{JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}
