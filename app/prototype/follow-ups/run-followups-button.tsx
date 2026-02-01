'use client';

import { useState } from 'react';

export default function RunFollowupsButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [samples, setSamples] = useState<
    Array<{ name: string; phone: string; message: string }>
  >([]);
  const [showSamples, setShowSamples] = useState(false);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [testToPhone, setTestToPhone] = useState('');
  const [sendVia, setSendVia] = useState<'whatsapp' | 'email'>('whatsapp');
  const [busy, setBusy] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);

  const runScheduler = async () => {
    setBusy(true);
    setStatus('Running...');
    try {
      const res = await fetch('/api/followups/run', { method: 'POST' });
      const data = await res.json();
      console.log('[followups/run]', { status: res.status, data });
      if (!res.ok) {
        setStatus(data?.error || 'Failed to run follow-ups.');
        setSamples([]);
      } else {
        if (data?.demo) {
          setStatus(data?.message || 'Demo mode.');
          const incomingSamples = data?.data?.samples || [];
          setSamples(incomingSamples);
          setShowSamples(incomingSamples.length > 0);
        } else {
          setStatus('Done. Check console output.');
          setSamples([]);
          setShowSamples(false);
        }
      }
    } catch (err) {
      setStatus('Failed to run follow-ups.');
      setSamples([]);
      setShowSamples(false);
    } finally {
      setBusy(false);
    }
  };

  const buildFollowups = async () => {
    setBuildBusy(true);
    setBuildStatus('Building...');
    try {
      const res = await fetch('/api/followups/build', { method: 'POST' });
      const data = await res.json();
      console.log('[followups/build]', { status: res.status, data });
      if (!res.ok) {
        setBuildStatus(data?.error || 'Build follow-ups failed.');
      } else if (data?.demo) {
        setBuildStatus(data?.message || 'Demo mode.');
      } else {
        setBuildStatus('Follow-ups built.');
      }
    } catch (err) {
      setBuildStatus('Build follow-ups failed.');
    } finally {
      setBuildBusy(false);
    }
  };

  const sendFollowups = async () => {
    setSendBusy(true);
    setSendStatus('Sending...');
    try {
      const provider = sendVia;
      const res = await fetch('/api/followups/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          sendVia,
          testToPhone: testToPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      console.log('[followups/send]', { status: res.status, data });
      if (!res.ok) {
        setSendStatus(data?.error || 'Send follow-ups failed.');
      } else if (data?.demo) {
        setSendStatus(data?.message || 'Demo mode.');
      } else {
        setSendStatus('Follow-ups sent.');
      }
    } catch (err) {
      setSendStatus('Send follow-ups failed.');
    } finally {
      setSendBusy(false);
    }
  };

  return (
    <div className="rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={testToPhone}
          onChange={(event) => setTestToPhone(event.target.value)}
          placeholder="Test phone (optional)"
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <span>Send via:</span>
          <select
            value={sendVia}
            onChange={(event) =>
              setSendVia(event.target.value as 'whatsapp' | 'email')
            }
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </label>
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
        <button
          type="button"
          onClick={runScheduler}
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Run Follow-Ups
        </button>
        {buildStatus && <span className="text-gray-700">{buildStatus}</span>}
        {sendStatus && <span className="text-gray-700">{sendStatus}</span>}
        {status && <span className="text-gray-700">{status}</span>}
      </div>
      {showSamples && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 text-sm text-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="text-base font-semibold">Demo samples</div>
              <button
                type="button"
                onClick={() => setShowSamples(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {samples.map((sample, index) => (
                <div
                  key={`${sample.phone}-${index}`}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="text-xs font-semibold text-gray-900">
                    {sample.name || 'Unknown'} {sample.phone ? `(${sample.phone})` : ''}
                  </div>
                  <div className="mt-2 text-xs text-gray-700">{sample.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
