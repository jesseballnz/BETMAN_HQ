import MetricCard, { PageTitle } from '@/components/MetricCard';
import { readGrowthSnapshot } from '@/lib/growth/snapshot';

export const dynamic = 'force-dynamic';

const money = (value: number) => new Intl.NumberFormat('en-NZ', {
  style: 'currency', currency: 'NZD', maximumFractionDigits: 2,
}).format(value);
const integer = (value: number) => new Intl.NumberFormat('en-NZ').format(value);

export default async function GrowthPage() {
  const snapshot = await readGrowthSnapshot();
  if (!snapshot) {
    return (
      <div>
        <PageTitle subtitle="Autonomous commercial intelligence">Growth Agent</PageTitle>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-amber-100">
          No Growth Agent snapshot is available. The worker has not completed its first collection cycle.
        </div>
      </div>
    );
  }

  const { funnel } = snapshot;
  return (
    <div>
      <PageTitle subtitle="Autonomous commercial intelligence">Growth Agent</PageTitle>
      <div className="mb-6 flex flex-wrap gap-2 text-xs font-bold">
        <span className={`rounded-full border px-3 py-1 ${snapshot.health.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {snapshot.health.ok ? 'Sources healthy' : 'Source failure'}
        </span>
        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-blue-300">
          DRY RUN · no campaign writes
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-slate-300">
          {snapshot.window.since} → {snapshot.window.until}
        </span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <MetricCard title="Meta Spend" value={money(funnel.spend)} accent="gold" />
        <MetricCard title="Landing Views" value={integer(funnel.landingPageViews)} accent="blue" />
        <MetricCard title="Commercial Signups" value={integer(funnel.commercialSignups)} subtitle={`${integer(funnel.unattributedSignups)} unattributed`} accent="green" />
        <MetricCard title="Activated Trials" value={integer(funnel.trials)} subtitle={`${integer(funnel.unattributedTrials)} unattributed`} accent="green" />
        <MetricCard title="Paid Customers" value={integer(funnel.paid)} subtitle={`${integer(funnel.unattributedPaid)} unattributed`} accent="gold" />
      </div>

      {snapshot.attribution && (
        <section className="mb-8 rounded-xl border border-slate-800 bg-gray-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Attribution coverage</h2>
              <p className="mt-1 text-xs text-slate-500">Exact Meta campaign-ID matches only. No timing-based credit.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${snapshot.attribution.signupMatchPct >= 80 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
              {snapshot.attribution.signupMatchPct.toFixed(2)}% signup match
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard title="Campaign Assigned" value={`${snapshot.attribution.signupAssignmentPct.toFixed(2)}%`} subtitle={`${integer(snapshot.attribution.campaignAssignedSignups)} of ${integer(snapshot.attribution.commercialSignups)} signups`} accent="blue" />
            <MetricCard title="Meta Matched" value={`${snapshot.attribution.signupMatchPct.toFixed(2)}%`} subtitle={`${integer(snapshot.attribution.metaMatchedSignups)} exact campaign IDs`} accent="blue" />
            <MetricCard title="Trial Match" value={`${snapshot.attribution.trialMatchPct.toFixed(2)}%`} subtitle={`${integer(snapshot.attribution.metaMatchedTrials)} of ${integer(snapshot.attribution.trials)} trials`} accent="green" />
            <MetricCard title="Paid Match" value={`${snapshot.attribution.paidMatchPct.toFixed(2)}%`} subtitle={`${integer(snapshot.attribution.metaMatchedPaid)} of ${integer(snapshot.attribution.paid)} paid`} accent="gold" />
          </div>
        </section>
      )}

      {snapshot.health.failures.length > 0 && (
        <section className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
          <h2 className="font-bold text-red-200">Collection failures</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-100/80">
            {snapshot.health.failures.map((failure) => <li key={failure}>{failure}</li>)}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-gray-900">
        <div className="border-b border-slate-800 p-5">
          <h2 className="text-lg font-bold">Decision ledger</h2>
          <p className="mt-1 text-xs text-slate-500">Deterministic recommendations. Execution remains disabled.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Campaign</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">LPVs</th>
                <th className="px-4 py-3 text-right">Trials</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-left">Decision</th>
                <th className="px-4 py-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.decisions.map((decision) => (
                <tr key={decision.campaignId} className="border-t border-slate-800">
                  <td className="max-w-[280px] truncate px-4 py-3 font-semibold" title={decision.campaign}>{decision.campaign}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(decision.evidence.spend)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{integer(decision.evidence.landingPageViews)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{integer(decision.evidence.trials)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{integer(decision.evidence.paid)}</td>
                  <td className="px-4 py-3 font-black uppercase text-emerald-300">{decision.action}</td>
                  <td className="max-w-[420px] px-4 py-3 text-xs text-slate-400">{decision.reason}</td>
                </tr>
              ))}
              {snapshot.decisions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No campaign data in this window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-3 text-xs text-slate-600">Generated {snapshot.generatedAt} · Sources: {Object.entries(snapshot.health.sources).map(([key, value]) => `${key}=${value}`).join(', ')}</p>
    </div>
  );
}
