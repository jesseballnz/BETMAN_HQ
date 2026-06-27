'use client';

import { useEffect, useState } from 'react';
import { Assumptions } from '@/lib/types';
import { PageTitle } from '@/components/MetricCard';

type FieldConfig = {
  key: keyof Assumptions;
  label: string;
  description: string;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
};

const FIELD_GROUPS: { title: string; fields: FieldConfig[] }[] = [
  {
    title: 'Pricing',
    fields: [
      {
        key: 'weeklyPassPriceNZD',
        label: 'Weekly Pass Price',
        description: 'Price per weekly subscription',
        prefix: 'NZ$',
        suffix: '/week',
        step: 0.05,
        min: 0,
      },
      {
        key: 'dayPassPriceNZD',
        label: 'Day Pass Price',
        description: 'Price per day pass',
        prefix: 'NZ$',
        suffix: '/day',
        step: 0.05,
        min: 0,
      },
    ],
  },
  {
    title: 'Subscriber Growth',
    fields: [
      {
        key: 'month1Subscribers',
        label: 'Month 1 Subscribers',
        description: 'Active weekly subscribers at end of Month 1',
        suffix: 'subscribers',
        step: 1,
        min: 0,
      },
      {
        key: 'month2Subscribers',
        label: 'Month 2 Subscribers',
        description: 'Active weekly subscribers at end of Month 2',
        suffix: 'subscribers',
        step: 1,
        min: 0,
      },
      {
        key: 'month3Subscribers',
        label: 'Month 3 Subscribers',
        description: 'Active weekly subscribers at end of Month 3',
        suffix: 'subscribers',
        step: 1,
        min: 0,
      },
      {
        key: 'month12Subscribers',
        label: 'Month 12 Target',
        description: 'Active weekly subscribers at end of Month 12',
        suffix: 'subscribers',
        step: 1,
        min: 0,
      },
    ],
  },
  {
    title: 'Revenue',
    fields: [
      {
        key: 'radioAdRevenue',
        label: 'Radio Ad Revenue',
        description: 'Monthly BETMAN Radio advertising revenue',
        prefix: 'NZ$',
        suffix: '/month',
        step: 100,
        min: 0,
      },
      {
        key: 'sponsorshipRevenue',
        label: 'Sponsorship Revenue',
        description: 'Monthly sponsorship revenue',
        prefix: 'NZ$',
        suffix: '/month',
        step: 100,
        min: 0,
      },
      {
        key: 'dayPassSalesPerMonth',
        label: 'Day Pass Sales',
        description: 'Average day passes sold per month',
        suffix: '/month',
        step: 5,
        min: 0,
      },
    ],
  },
  {
    title: 'Expenses',
    fields: [
      {
        key: 'baseHostingAiElevenLabsNZD',
        label: 'Hosting / AI / ElevenLabs',
        description: 'Combined monthly baseline for hosting, AI and ElevenLabs',
        prefix: 'NZ$',
        suffix: '/month',
        step: 100,
        min: 0,
      },
      {
        key: 'contentCommunityNZD',
        label: 'Content & Community',
        description: 'Monthly content & community spend',
        prefix: 'NZ$',
        suffix: '/month',
        step: 100,
        min: 0,
      },
      {
        key: 'administrationNZD',
        label: 'Administration',
        description: 'Monthly administration costs',
        prefix: 'NZ$',
        suffix: '/month',
        step: 50,
        min: 0,
      },
      {
        key: 'softwareNZD',
        label: 'Software',
        description: 'Monthly software subscriptions',
        prefix: 'NZ$',
        suffix: '/month',
        step: 50,
        min: 0,
      },
      {
        key: 'insuranceNZD',
        label: 'Insurance',
        description: 'Monthly insurance costs',
        prefix: 'NZ$',
        suffix: '/month',
        step: 50,
        min: 0,
      },
      {
        key: 'professionalFeesNZD',
        label: 'Professional Fees',
        description: 'Monthly professional fees (accounting, legal)',
        prefix: 'NZ$',
        suffix: '/month',
        step: 50,
        min: 0,
      },
    ],
  },
  {
    title: 'Cash & Treasury',
    fields: [
      {
        key: 'openingCashNZD',
        label: 'Opening Cash Balance',
        description: 'Starting operating cash balance',
        prefix: 'NZ$',
        step: 500,
        min: 0,
      },
      {
        key: 'tentOpeningBalanceNZD',
        label: 'TENT Opening Balance',
        description: 'Starting TENT treasury balance (separate from operations)',
        prefix: 'NZ$',
        step: 500,
        min: 0,
      },
    ],
  },
];

export default function AssumptionsPage() {
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/assumptions')
      .then((r) => r.json())
      .then(setAssumptions);
  }, []);

  const handleChange = (key: keyof Assumptions, value: string) => {
    if (!assumptions) return;
    setAssumptions({ ...assumptions, [key]: parseFloat(value) || 0 });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!assumptions) return;
    setSaving(true);
    await fetch('/api/assumptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assumptions),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = async () => {
    if (!confirm('Reset all assumptions to defaults?')) return;
    const res = await fetch('/api/assumptions', { method: 'DELETE' });
    const data = await res.json();
    setAssumptions(data);
    setSaved(false);
  };

  if (!assumptions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading assumptions…</div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle subtitle="These assumptions drive all forecast calculations">
        Assumptions
      </PageTitle>

      <div className="flex gap-3 mb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Assumptions'}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-slate-300 text-sm font-semibold rounded-lg transition-colors"
        >
          Reset to Defaults
        </button>
        <a
          href="/"
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          ↻ Refresh Dashboard
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-slate-200 text-base font-bold mb-4">{group.title}</h2>
            <div className="space-y-4">
              {group.fields.map(({ key, label, description, prefix, suffix, step, min }) => (
                <div key={key}>
                  <label className="block text-slate-300 text-sm font-medium mb-1">{label}</label>
                  <p className="text-slate-500 text-xs mb-2">{description}</p>
                  <div className="flex items-center gap-2">
                    {prefix && (
                      <span className="text-slate-500 text-sm font-mono">{prefix}</span>
                    )}
                    <input
                      type="number"
                      value={assumptions[key]}
                      step={step ?? 1}
                      min={min ?? 0}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
                    />
                    {suffix && (
                      <span className="text-slate-500 text-sm whitespace-nowrap">{suffix}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <p className="text-blue-300 text-sm">
          <strong>ℹ️ Note:</strong> After saving assumptions, navigate to the Dashboard or any other
          page to see the updated forecasts. All calculations are driven from these assumptions.
          Assumptions are stored in memory and reset on server restart. Connect a database for
          persistent storage.
        </p>
      </div>
    </div>
  );
}
