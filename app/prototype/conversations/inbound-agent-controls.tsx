'use client';

import { useState } from 'react';

export default function InboundAgentControls() {
  const [status, setStatus] = useState<string | null>(null);
  const [agentState, setAgentState] = useState<'running' | 'stopped' | 'idle'>(
    'idle'
  );
  const [busy, setBusy] = useState(false);

  const startAgent = async () => {
    setBusy(true);
    setStatus('Starting...');
    try {
      const res = await fetch('/api/inbound-agent/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || 'Failed to start inbound agent.');
        setAgentState('stopped');
      } else {
        setStatus(`Running on ${data?.url || 'port 5000'}`);
        setAgentState('running');
      }
    } catch (err) {
      setStatus('Failed to start inbound agent.');
    } finally {
      setBusy(false);
    }
  };

  const stopAgent = async () => {
    setBusy(true);
    setStatus('Stopping...');
    try {
      const res = await fetch('/api/inbound-agent/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data?.error || 'Failed to stop inbound agent.');
      } else {
        setStatus('Inbound agent stopped.');
        setAgentState('stopped');
      }
    } catch (err) {
      setStatus('Failed to stop inbound agent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
            agentState === 'running'
              ? 'bg-green-100 text-green-700'
              : agentState === 'stopped'
                ? 'bg-gray-200 text-gray-700'
                : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {agentState === 'running'
            ? 'Running'
            : agentState === 'stopped'
              ? 'Stopped'
              : 'Idle'}
        </span>
        <button
          type="button"
          onClick={startAgent}
          disabled={busy}
          className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Inbound Agent
        </button>
        <button
          type="button"
          onClick={stopAgent}
          disabled={busy}
          className="rounded-md bg-gray-600 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Stop Inbound Agent
        </button>
        {status && <span className="text-gray-700">{status}</span>}
      </div>
    </div>
  );
}
