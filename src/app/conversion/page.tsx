import MetricCard, { PageTitle } from '@/components/MetricCard';
import { fetchCoreAuthSummary } from '@/lib/betmanCore';
import { fmtNumber } from '@/lib/calculations';
import { normalizeConversionTraffic } from '@/lib/hqConversion';
import LandingMap from './LandingMap';

export const dynamic = 'force-dynamic';

function fmtPct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(2)}%` : '-';
}

export default async function ConversionPage() {
  const summary = await fetchCoreAuthSummary().catch(() => null);
  const traffic = normalizeConversionTraffic(summary);
  const totals = traffic.campaigns.reduce((sum, row) => ({
    landingSessions: sum.landingSessions + row.landingSessions,
    signups: sum.signups + row.signups,
    trials: sum.trials + row.trials,
    verifiedTrials: sum.verifiedTrials + row.verifiedTrials,
    conversions: sum.conversions + row.conversions,
  }), { landingSessions: 0, signups: 0, trials: 0, verifiedTrials: 0, conversions: 0 });

  return (
    <div>
      <PageTitle subtitle="Advertising -> traffic -> trials -> paying customers">User Conversion</PageTitle>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          traffic.available && !traffic.stale
            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${traffic.available && !traffic.stale ? 'bg-blue-300' : 'bg-amber-400'}`} />
          Owned logs · {traffic.available ? (traffic.stale ? 'stale' : 'live') : 'unavailable'}
        </div>
      </div>

      <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Owned Funnel</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <a href="#landing-map" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="View landing session map">
          <MetricCard title="Landing Sessions" value={fmtNumber(totals.landingSessions)} subtitle="Deduplicated campaign visits · View map" accent="blue" />
        </a>
        <MetricCard title="Signups" value={fmtNumber(totals.signups)} subtitle={`${fmtPct(totals.signups, totals.landingSessions)} signup rate`} accent="green" />
        <MetricCard title="Trials" value={fmtNumber(totals.trials)} subtitle={`${fmtNumber(totals.verifiedTrials)} verified`} accent="green" />
        <MetricCard title="Paid" value={fmtNumber(totals.conversions)} subtitle={`${fmtPct(totals.conversions, totals.trials)} trial conversion`} accent="gold" />
      </div>

      <LandingMap
        rows={traffic.geographies}
        cities={traffic.cities}
        resolution={traffic.geographyResolution}
        marketMetrics={[]}
      />

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-slate-200 text-lg font-bold">Campaign Performance</h2>
            <p className="text-slate-500 text-xs mt-1">BETMAN landing, signup, trial and conversion events from Core.</p>
          </div>
          {traffic.generatedAt && (
            <span className="text-slate-500 text-xs">Last refreshed {new Date(traffic.generatedAt).toLocaleString('en-NZ')}</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Platform</th>
                <th className="text-left py-2 px-3">Campaign</th>
                <th className="text-right py-2 px-3">Landings</th>
                <th className="text-right py-2 px-3">Signups</th>
                <th className="text-right py-2 px-3">Trials</th>
                <th className="text-right py-2 px-3">Verified</th>
                <th className="text-right py-2 px-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {traffic.campaigns.map((row) => (
                <tr key={`${row.platform}-${row.campaign}`} className="border-b border-gray-800 text-sm">
                  <td className="py-3 px-3 text-slate-300 capitalize">{row.platform}</td>
                  <td className="py-3 px-3 text-slate-200 font-semibold">{row.campaign}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-blue-300">{fmtNumber(row.landingSessions)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-300">{fmtNumber(row.signups)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-300">{fmtNumber(row.trials)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-emerald-300">{fmtNumber(row.verifiedTrials)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-amber-300">{fmtNumber(row.conversions)}</td>
                </tr>
              ))}
              {!traffic.campaigns.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">No campaign rows are available yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-slate-600 text-xs">
        Landing sessions come from deduplicated BETMAN access logs. Trial and paid outcomes come from Core account state.
      </p>
    </div>
  );
}

