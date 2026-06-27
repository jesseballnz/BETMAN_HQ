import { getAssumptions } from '@/data/store';
import { getLiveSubscriberCounts } from '@/data/liveCounts';
import {
  fetchBetmanStats,
  fetchUsageSummary,
  fetchTenants,
  isBetmanApiConfigured,
  BetmanStatsOverview,
} from '@/lib/betmanApi';
import { buildMonthlyForecast, buildKpiSnapshots, fmtNZD, fmtNumber, fmtPct } from '@/lib/calculations';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

export default async function KpiPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const kpis = buildKpiSnapshots(forecast, assumptions);

  // Parallel: live subscribers + BETMAN_DATA platform stats
  const [liveResult, statsResult, usageResult, tenantsResult] = await Promise.allSettled([
    getLiveSubscriberCounts(),
    isBetmanApiConfigured() ? fetchBetmanStats() : Promise.resolve(null),
    isBetmanApiConfigured() ? fetchUsageSummary(7) : Promise.resolve([]),
    isBetmanApiConfigured() ? fetchTenants() : Promise.resolve([]),
  ]);

  const live = liveResult.status === 'fulfilled' ? liveResult.value : { activeWeeklySubscribers: 0, activeDayPassSalesPerMonth: 0, source: 'assumptions' as const, isLive: false, fetchedAt: new Date().toISOString() };
  const platformStats: BetmanStatsOverview | null = statsResult.status === 'fulfilled' ? statsResult.value : null;
  const usageData = usageResult.status === 'fulfilled' ? usageResult.value : [];
  const tenants = tenantsResult.status === 'fulfilled' ? tenantsResult.value : [];

  const currentSubs = live.activeWeeklySubscribers;
  const dayPassSales = live.activeDayPassSalesPerMonth > 0
    ? live.activeDayPassSalesPerMonth
    : assumptions.dayPassSalesPerMonth;

  const mrr = Math.round(currentSubs * assumptions.weeklyPassPriceNZD * 4.33);
  const totalRevenue =
    mrr +
    Math.round(dayPassSales * assumptions.dayPassPriceNZD) +
    assumptions.radioAdRevenue +
    assumptions.sponsorshipRevenue;

  const current = {
    activeWeeklySubscribers: currentSubs,
    newSubscribers: kpis[0].newSubscribers,
    lostSubscribers: kpis[0].lostSubscribers,
    churnPct: kpis[0].churnPct,
    mrr,
    arr: mrr * 12,
    revenuePerSubscriber: currentSubs > 0 ? totalRevenue / currentSubs : 0,
    dayPassSales,
    radioListeners: Math.round(currentSubs * 3),
    telegramMembers: Math.round(currentSubs * 1.5),
    socialViews: Math.round(currentSubs * 200),
    contentToSubConversion: kpis[0].contentToSubConversion,
    aiCostPerSubscriber: currentSubs > 0 ? (assumptions.baseHostingAiElevenLabsNZD * 0.4) / currentSubs : 0,
    hostingCostPerSubscriber: currentSubs > 0 ? (assumptions.baseHostingAiElevenLabsNZD * 0.6) / currentSubs : 0,
    contentSpendPerSubscriber: currentSubs > 0 ? assumptions.contentCommunityNZD / currentSubs : 0,
  };

  const activeTenants = tenants.filter((t) => t.active).length;

  return (
    <div>
      <PageTitle subtitle="Key Performance Indicators — Live dashboard">KPI Dashboard</PageTitle>

      {/* Source banner */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${
        live.source === 'stripe'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${live.source === 'stripe' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
        {live.source === 'stripe' ? `Live from Stripe · ${fmtNumber(currentSubs)} active subscribers` : 'Demo data · Connect Stripe for live counts'}
      </div>

      {/* Subscriber KPI Cards */}
      <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Subscribers & Revenue</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Active Weekly Subscribers" value={fmtNumber(current.activeWeeklySubscribers)} accent="emerald" />
        <KpiCard title="New Subscribers" value={`+${fmtNumber(current.newSubscribers)}`} accent="emerald" />
        <KpiCard title="Lost Subscribers" value={`-${fmtNumber(current.lostSubscribers)}`} accent="red" />
        <KpiCard title="Churn Rate" value={fmtPct(current.churnPct)} accent={current.churnPct > 10 ? 'red' : 'amber'} />
        <KpiCard title="MRR" value={fmtNZD(current.mrr)} accent="emerald" />
        <KpiCard title="ARR" value={fmtNZD(current.arr)} accent="emerald" />
        <KpiCard title="Revenue / Subscriber" value={fmtNZD(current.revenuePerSubscriber)} accent="blue" />
        <KpiCard title="Day Pass Sales" value={fmtNumber(current.dayPassSales)} accent="blue" />
      </div>

      {/* Audience KPI Cards */}
      <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Audience & Reach</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Radio Listeners" value={fmtNumber(current.radioListeners)} accent="amber" />
        <KpiCard title="Telegram Members" value={fmtNumber(current.telegramMembers)} accent="amber" />
        <KpiCard title="Social Views" value={fmtNumber(current.socialViews)} accent="amber" />
        <KpiCard title="Content → Sub Conversion" value={fmtPct(current.contentToSubConversion)} accent="blue" />
        <KpiCard title="AI Cost / Subscriber" value={fmtNZD(current.aiCostPerSubscriber)} />
        <KpiCard title="Hosting Cost / Subscriber" value={fmtNZD(current.hostingCostPerSubscriber)} />
        <KpiCard title="Content Spend / Subscriber" value={fmtNZD(current.contentSpendPerSubscriber)} />
      </div>

      {/* BETMAN_DATA Platform Stats */}
      {platformStats ? (
        <>
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            BETMAN Platform · Data Warehouse
            <span className="ml-2 text-emerald-400 normal-case font-normal">live from BETMAN_DATA API</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Meetings (Total)" value={fmtNumber(platformStats.counts.meetings)} accent="blue" />
            <KpiCard title="Races (Total)" value={fmtNumber(platformStats.counts.races)} accent="blue" />
            <KpiCard title="Runners (Total)" value={fmtNumber(platformStats.counts.runners)} accent="blue" />
            <KpiCard title="Odds Snapshots" value={fmtNumber(platformStats.counts.odds_snapshots)} accent="blue" />
            <KpiCard title="Meetings Today" value={fmtNumber(platformStats.counts.meetings_today)} accent="emerald" />
            <KpiCard title="Races Today" value={fmtNumber(platformStats.counts.races_today)} accent="emerald" />
            <KpiCard title="Runners Today" value={fmtNumber(platformStats.counts.runners_today)} accent="emerald" />
            <KpiCard title="Odds Snapshots (24h)" value={fmtNumber(platformStats.ingestion_last_24h.odds_snapshots_24h)} accent="emerald" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <KpiCard title="Weather Readings (24h)" value={fmtNumber(platformStats.ingestion_last_24h.weather_readings_24h)} />
            <KpiCard title="Media Segments (24h)" value={fmtNumber(platformStats.ingestion_last_24h.media_segments_24h)} />
            <KpiCard
              title="Latest Meeting Date"
              value={platformStats.freshness.latest_meeting_date ?? '—'}
            />
          </div>
        </>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-8 text-slate-400 text-sm">
          BETMAN_DATA platform stats not available — set <code className="text-amber-400">BETMAN_API_URL</code> and <code className="text-amber-400">BETMAN_API_KEY</code> to enable.
        </div>
      )}

      {/* B2B Tenants + Usage */}
      {tenants.length > 0 && (
        <>
          <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
            B2B Licensees
            <span className="ml-2 text-emerald-400 normal-case font-normal">from BETMAN_DATA API</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <KpiCard title="Active Tenants" value={fmtNumber(activeTenants)} accent="emerald" />
            <KpiCard title="Total Tenants" value={fmtNumber(tenants.length)} accent="blue" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h3 className="text-slate-300 text-sm font-semibold mb-4">Tenant Roster</h3>
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-gray-700">
                  <th className="text-left py-2 px-3">Tenant</th>
                  <th className="text-left py-2 px-3">License</th>
                  <th className="text-left py-2 px-3">Expires</th>
                  <th className="text-right py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                    <td className="py-2 px-3 text-slate-200 font-medium">{t.name}</td>
                    <td className="py-2 px-3 text-slate-400 capitalize">{t.license_type}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">
                      {t.license_expires_at ? new Date(t.license_expires_at).toLocaleDateString('en-NZ') : '—'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {t.active
                        ? <span className="text-emerald-400 text-xs">● Active</span>
                        : <span className="text-red-400 text-xs">● Inactive</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* API Usage */}
      {usageData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-slate-300 text-sm font-semibold mb-4">API Usage (Last 7 Days)</h3>
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Tenant</th>
                <th className="text-left py-2 px-3">Day</th>
                <th className="text-right py-2 px-3">Requests</th>
                <th className="text-right py-2 px-3">Errors</th>
                <th className="text-right py-2 px-3">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {usageData.map((row, i) => {
                const errRate = row.requests > 0 ? (row.error_requests / row.requests) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                    <td className="py-2 px-3 text-slate-300">{row.tenant_slug}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{new Date(row.day).toLocaleDateString('en-NZ')}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-blue-400">{fmtNumber(row.requests)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtNumber(row.error_requests)}</td>
                    <td className={`py-2 px-3 text-right tabular-nums ${errRate > 5 ? 'text-red-400' : 'text-slate-400'}`}>{fmtPct(errRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly KPI Trend Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly KPI Trend (Forecast)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Subs</th>
                <th className="text-right py-2 px-3">New</th>
                <th className="text-right py-2 px-3">Lost</th>
                <th className="text-right py-2 px-3">Churn</th>
                <th className="text-right py-2 px-3">MRR</th>
                <th className="text-right py-2 px-3">ARR</th>
                <th className="text-right py-2 px-3">Rev/Sub</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => (
                <tr key={kpi.month} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                  <td className="py-2 px-3 text-slate-300 font-medium">{kpi.monthLabel}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">{fmtNumber(kpi.activeWeeklySubscribers)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">+{fmtNumber(kpi.newSubscribers)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-red-400">-{fmtNumber(kpi.lostSubscribers)}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${kpi.churnPct > 10 ? 'text-red-400' : 'text-amber-400'}`}>{fmtPct(kpi.churnPct)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-200">{fmtNZD(kpi.mrr)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtNZD(kpi.arr)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-blue-400">{fmtNZD(kpi.revenuePerSubscriber)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  accent = 'default',
}: {
  title: string;
  value: string;
  accent?: 'emerald' | 'red' | 'amber' | 'blue' | 'default';
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    default: 'text-slate-200',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-xl font-black tabular-nums ${colorMap[accent]}`}>{value}</p>
    </div>
  );
}
