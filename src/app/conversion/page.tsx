import MetricCard, { PageTitle } from '@/components/MetricCard';
import { fetchCoreAuthSummary } from '@/lib/betmanCore';
import { fmtNumber } from '@/lib/calculations';
import { buildGeoSuccessSummary } from '@/lib/geoSuccess';
import { normalizeConversionTraffic } from '@/lib/hqConversion';
import { fetchMetaMarketMetrics } from '@/lib/metaAds';
import { buildSourceSuccessSummary } from '@/lib/sourceSuccess';
import { buildTargetMarketRows } from '@/lib/targetMarkets';
import LandingMap from './LandingMap';

export const dynamic = 'force-dynamic';

function fmtPct(numerator: number, denominator: number): string {
  return denominator > 0 ? `${((numerator / denominator) * 100).toFixed(2)}%` : '-';
}

function fmtCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ConversionPage() {
  const [summary, marketMetrics] = await Promise.all([
    fetchCoreAuthSummary().catch(() => null),
    fetchMetaMarketMetrics().catch(() => []),
  ]);
  const traffic = normalizeConversionTraffic(summary);
  const totals = traffic.campaigns.reduce((sum, row) => ({
    landingSessions: sum.landingSessions + row.landingSessions,
    signups: sum.signups + row.signups,
    trials: sum.trials + row.trials,
    verifiedTrials: sum.verifiedTrials + row.verifiedTrials,
    conversions: sum.conversions + row.conversions,
  }), { landingSessions: 0, signups: 0, trials: 0, verifiedTrials: 0, conversions: 0 });
  const geoSuccess = buildGeoSuccessSummary(traffic.geographies, traffic.cities, totals.landingSessions, marketMetrics);
  const sourceSuccess = buildSourceSuccessSummary(traffic.campaigns);
  const marketCurrencies = Array.from(new Set(marketMetrics.filter((row) => row.spend > 0).map((row) => row.currency)));
  const marketCurrency = marketCurrencies[0] || 'NZD';
  const marketTotals = marketMetrics.reduce((sum, row) => ({
    spend: sum.spend + row.spend,
    impressions: sum.impressions + row.impressions,
    reach: sum.reach + row.reach,
    clicks: sum.clicks + row.clicks,
    landingPageViews: sum.landingPageViews + row.landingPageViews,
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, landingPageViews: 0 });
  const targetMarketRows = buildTargetMarketRows(traffic.geographies, traffic.cities, marketMetrics);

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

      <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">30-Day Advertising</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Meta Spend"
          value={marketCurrencies.length <= 1 ? fmtCurrency(marketTotals.spend, marketCurrency) : 'Mixed'}
          subtitle={`${fmtNumber(marketMetrics.length)} countries with delivery`}
          accent="gold"
        />
        <MetricCard title="Impressions" value={fmtNumber(marketTotals.impressions)} subtitle={`${fmtNumber(marketTotals.reach)} reach`} accent="blue" />
        <MetricCard title="Ad Clicks" value={fmtNumber(marketTotals.clicks)} subtitle={`${fmtPct(marketTotals.clicks, marketTotals.impressions)} CTR`} accent="blue" />
        <MetricCard title="Meta LPV" value={fmtNumber(marketTotals.landingPageViews)} subtitle={`${fmtPct(marketTotals.landingPageViews, marketTotals.clicks)} click -> landing`} accent="green" />
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
        marketMetrics={marketMetrics}
      />

      <section className="mb-8 rounded-xl border border-slate-800 bg-gray-900 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Target Market Success</h2>
            <p className="mt-1 text-xs text-slate-500">NZ, Australia and Hong Kong delivery joined to owned landing traffic.</p>
          </div>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
            HK target visible
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {targetMarketRows.map((row) => (
            <div key={row.code} className="rounded-lg border border-slate-800 bg-slate-950/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="rounded-md px-2 py-1 text-[10px] font-black tracking-wider text-slate-950" style={{ backgroundColor: row.colour }}>
                    {row.short}
                  </span>
                  <p className="mt-3 truncate text-sm font-bold text-slate-200">{row.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black tabular-nums text-white">{fmtNumber(row.metaLandingPageViews)}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Meta LPV</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.sharePct)}%`, backgroundColor: row.colour }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><p className="text-slate-600">Owned sessions</p><p className="font-bold tabular-nums text-blue-300">{fmtNumber(row.ownedSessions)}</p></div>
                <div><p className="text-slate-600">Areas</p><p className="font-bold tabular-nums text-cyan-300">{fmtNumber(row.areas)}</p></div>
                <div><p className="text-slate-600">Clicks</p><p className="font-bold tabular-nums text-slate-200">{fmtNumber(row.clicks)}</p></div>
                <div><p className="text-slate-600">Spend</p><p className="font-bold tabular-nums text-slate-200">{fmtCurrency(row.spend, row.currency)}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-slate-800 bg-gray-900 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Source Success</h2>
            <p className="mt-1 text-xs text-slate-500">Traffic sources clocked from owned landing logs.</p>
          </div>
          <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
            {fmtNumber(sourceSuccess.campaigns)} campaigns
          </span>
        </div>

        <div className="space-y-3">
          {sourceSuccess.rows.map((row) => (
            <div key={row.platform}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold capitalize text-slate-300">{row.platform}</span>
                <span className="font-black tabular-nums text-white">
                  {fmtNumber(row.landingSessions)} / {fmtNumber(row.campaigns)} campaigns
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, row.sharePct)}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                <div><p className="text-slate-600">Signups</p><p className="font-bold tabular-nums text-emerald-300">{fmtNumber(row.signups)}</p></div>
                <div><p className="text-slate-600">Trials</p><p className="font-bold tabular-nums text-emerald-300">{fmtNumber(row.trials)}</p></div>
                <div><p className="text-slate-600">Verified</p><p className="font-bold tabular-nums text-emerald-300">{fmtNumber(row.verifiedTrials)}</p></div>
                <div><p className="text-slate-600">Paid</p><p className="font-bold tabular-nums text-amber-300">{fmtNumber(row.conversions)}</p></div>
              </div>
            </div>
          ))}
          {!sourceSuccess.rows.length && (
            <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              Source success will appear after owned landing traffic is aggregated.
            </p>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-slate-800 bg-gray-900 p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Geo Success</h2>
            <p className="mt-1 text-xs text-slate-500">Countries and areas clocked from owned landing traffic.</p>
          </div>
          <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
            {fmtNumber(geoSuccess.areas)} areas
          </span>
        </div>

        <div className="space-y-3">
          {geoSuccess.rows.slice(0, 8).map((row) => (
            <div key={row.countryCode}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-slate-300">
                  {row.country} <span className="text-slate-600">{row.countryCode}</span>
                </span>
                <span className="font-black tabular-nums text-white">
                  {fmtNumber(row.landingSessions)} / {fmtNumber(row.areas)} areas
                </span>
              </div>
              {row.metaLandingPageViews > 0 && (
                <div className="mt-1 text-xs font-semibold tabular-nums text-amber-300">
                  {fmtNumber(row.metaLandingPageViews)} Meta LPV
                </div>
              )}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, row.sharePct)}%` }} />
              </div>
            </div>
          ))}
          {!geoSuccess.rows.length && (
            <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              Geo success will appear after owned landing traffic is aggregated.
            </p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-800 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-600">Landings</p>
            <p className="text-lg font-black text-white">{fmtNumber(geoSuccess.landingSessions)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-600">Countries</p>
            <p className="text-lg font-black text-cyan-300">{fmtNumber(geoSuccess.countries)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-600">Areas</p>
            <p className="text-lg font-black text-cyan-300">{fmtNumber(geoSuccess.areas)}</p>
          </div>
        </div>
      </section>

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
