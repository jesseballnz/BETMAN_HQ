'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fmtNZD, fmtNumber } from '@/lib/calculations';
import type { Assumptions, MonthlyForecast } from '@/lib/types';
import type { LiveCounts } from '@/data/liveCounts';
import { PNL_STRUCTURE, cellClass } from './pnlConfig';

interface MonthlyPnLTableProps {
  assumptions: Assumptions;
  fallbackSubscribers: number[];
  forecast: MonthlyForecast[];
  live: LiveCounts;
}

function normalizedTargets(assumptions: Assumptions): Array<number | null> {
  const targets = assumptions.forecastSubscriberTargets;
  return Array.from({ length: 12 }, (_, index) => {
    const value = targets?.[index];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  });
}

export function MonthlyPnLTable({ assumptions, fallbackSubscribers, forecast, live }: MonthlyPnLTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const targets = normalizedTargets(assumptions);
  const [inputs, setInputs] = useState(() => targets.map((value) => value === null ? '' : String(value)));
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const monthLabels = forecast.map((month) => month.monthLabel);

  function updateInput(index: number, value: string) {
    setInputs((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    setSaveState('idle');
  }

  function clearOpenOverrides() {
    setInputs(forecast.map((month, index) => month.isClosed ? inputs[index] : ''));
    setSaveState('idle');
  }

  function saveForecast() {
    setSaveState('idle');
    const forecastSubscriberTargets = inputs.map((value, index) => {
      if (forecast[index]?.isClosed) return targets[index];
      if (value.trim() === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : null;
    });

    startTransition(async () => {
      const response = await fetch('/api/assumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forecastSubscriberTargets }),
      });
      if (!response.ok) {
        setSaveState('error');
        return;
      }
      setSaveState('saved');
      router.refresh();
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-slate-200 text-lg font-bold">Forecast Users</h2>
          <p className="text-slate-500 text-sm mt-1">Enter forecast subscribers per month. Blank months use the growth target curve.</p>
        </div>
        <div className="flex items-center gap-2">
          {saveState === 'saved' && <span className="text-xs text-emerald-400">Saved</span>}
          {saveState === 'error' && <span className="text-xs text-red-400">Save failed</span>}
          <button
            type="button"
            onClick={clearOpenOverrides}
            className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-slate-100 border border-gray-700 rounded-md disabled:opacity-60"
            disabled={isPending}
          >
            Clear overrides
          </button>
          <button
            type="button"
            onClick={saveForecast}
            className="px-4 py-2 text-sm font-semibold text-gray-950 bg-emerald-400 hover:bg-emerald-300 rounded-md disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save forecast'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-gray-700">
              <th className="text-left py-2 px-3 w-52">Item</th>
              {monthLabels.map((month) => (
                <th key={month} className="text-right py-2 px-2 min-w-[92px]">{month}</th>
              ))}
              <th className="text-right py-2 px-3 min-w-[90px] text-slate-300 font-bold">Annual</th>
            </tr>
            <tr className="border-b border-gray-800 bg-gray-950/35">
              <th className="text-left py-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-400">Subscribers</th>
              {monthLabels.map((month, index) => {
                const row = forecast[index];
                const isCurrentActual = row?.isCurrent && live.source === 'stripe';
                const isClosed = Boolean(row?.isClosed);
                const fallback = fallbackSubscribers[index] ?? 0;
                const value = live.source === 'stripe' && row && (isCurrentActual || isClosed)
                  ? String(row.activeWeeklySubscribers)
                  : inputs[index];
                return (
                  <th key={month} className="py-3 px-2 text-right align-top">
                    <label className="block">
                      <span className="sr-only">{month} subscriber forecast</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={value}
                        placeholder={fmtNumber(fallback)}
                        onChange={(event) => updateInput(index, event.target.value)}
                        disabled={isCurrentActual || isClosed}
                        className="w-full bg-gray-950 border border-gray-700 rounded-md px-2 py-2 text-right text-sm font-black tabular-nums text-slate-100 placeholder:text-slate-600 disabled:border-emerald-500/30 disabled:text-emerald-400"
                      />
                    </label>
                    <div className="mt-1 min-h-4 text-[10px] leading-tight text-slate-500">
                      {isCurrentActual ? (
                        <span className="text-emerald-400">actual</span>
                      ) : isClosed && live.source === 'stripe' ? (
                        <span className="text-emerald-400">closed actual</span>
                      ) : isClosed ? (
                        <span className="text-slate-500">closed</span>
                      ) : (
                        <>Blank: {fmtNumber(fallback)}</>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-right align-top text-xs text-slate-500">
                End: {fmtNumber(forecast[forecast.length - 1]?.activeWeeklySubscribers ?? 0)}
              </th>
            </tr>
          </thead>
          <tbody>
            {PNL_STRUCTURE.map((line, index) => {
              if (line.style === 'spacer') return <tr key={index} className="h-3" />;
              if (line.style === 'header') {
                return (
                  <tr key={index} className="border-b border-gray-700">
                    <td colSpan={14} className="py-3 px-3 text-slate-400 text-xs font-bold uppercase tracking-widest">{line.label}</td>
                  </tr>
                );
              }

              const values = forecast.map((month) => line.values(month));
              const annual = values.reduce((sum, value) => sum + value, 0);
              return (
                <tr key={index} className={`border-b border-gray-800 text-sm hover:bg-gray-800/30 ${line.style === 'total' ? 'border-t border-gray-700 bg-gray-800/30' : ''}`}>
                  <td className={`py-2 px-3 ${cellClass(line.style)}`}>{line.label}</td>
                  {values.map((value, monthIndex) => (
                    <td key={monthIndex} className={`py-2 px-2 text-right tabular-nums ${cellClass(line.style, value)}`}>
                      {value !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(value) : '-'}
                    </td>
                  ))}
                  <td className={`py-2 px-3 text-right tabular-nums font-semibold ${cellClass(line.style, annual)}`}>
                    {annual !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(annual) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
