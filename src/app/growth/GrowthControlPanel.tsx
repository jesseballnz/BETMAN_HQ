'use client';

import { useState } from 'react';
import type { GrowthControlState, GrowthOperatingMode } from '@/lib/growth/control';

interface Props {
  initialControl: GrowthControlState;
  liveReady: boolean;
  blockers: string[];
}

export default function GrowthControlPanel({ initialControl, liveReady, blockers }: Props) {
  const [control, setControl] = useState(initialControl);
  const [target, setTarget] = useState<GrowthOperatingMode | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function confirmChange() {
    if (!target || !password) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/growth/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: target, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.error === 'invalid_credentials'
          ? 'Admin password was not accepted.'
          : (body.blockers?.join(' · ') || 'Mode change failed.'));
        return;
      }
      setControl(body.control);
      setTarget(null);
      setPassword('');
      setMessage(`Growth Agent changed to ${String(body.control.mode).toUpperCase()} mode.`);
    } catch {
      setMessage('Mode change failed.');
    } finally {
      setBusy(false);
    }
  }

  const requestedLive = target === 'live';
  return (
    <section className="mb-8 rounded-xl border border-slate-800 bg-gray-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Operating mode</p>
          <h2 className="mt-1 text-xl font-black text-white">{control.mode === 'live' ? 'Live' : 'Watch'}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Watch records deterministic actions without campaign writes. Live permits the guarded worker to resolve eligible actions automatically.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-1">
          {(['watch', 'live'] as GrowthOperatingMode[]).map((mode) => {
            const disabled = mode === control.mode || (mode === 'live' && !liveReady);
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => { setTarget(mode); setPassword(''); setMessage(''); }}
                className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wide ${control.mode === mode
                  ? (mode === 'live' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white')
                  : 'text-slate-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'}`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

      {!liveReady && blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-amber-300">Live locked</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100/80">
            {blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        </div>
      )}

      {target && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-4">
          <p className="font-bold text-white">Confirm {target.toUpperCase()} mode</p>
          <p className="mt-1 text-xs text-slate-400">Re-enter the BETMAN admin password. It is verified by Core and is never stored by HQ.</p>
          {requestedLive && !liveReady && <p className="mt-2 text-sm text-amber-300">Live remains locked until every safety gate passes.</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Admin password"
              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-black px-3 py-2 text-sm text-white"
            />
            <button type="button" disabled={busy || !password || (requestedLive && !liveReady)} onClick={confirmChange} className="rounded-md bg-white px-4 py-2 text-sm font-black text-black disabled:opacity-40">
              {busy ? 'Verifying…' : 'Verify and change'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setTarget(null); setPassword(''); }} className="rounded-md border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
      {control.updatedAt && <p className="mt-3 text-xs text-slate-600">Last changed {control.updatedAt} by {control.updatedBy || 'admin'}.</p>}
    </section>
  );
}
