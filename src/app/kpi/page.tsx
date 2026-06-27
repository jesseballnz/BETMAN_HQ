import { getAssumptions } from '@/data/store';
import { getLiveSubscriberCounts } from '@/data/liveCounts';
import { buildMonthlyForecast, buildKpiSnapshots, fmtNZD, fmtNumber, fmtPct } from '@/lib/calculations';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

export default async function KpiPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const kpis = buildKpiSnapshots(forecast, assumptions);

  // Override Month 1 KPIs with live Stripe counts
  const live = await getLiveSubscriberCounts();
  const currentSubs = live.activeWeeklySubscribers;
  const dayPassSales = live.activeDayPassSalesPerMonth > 0
    ? live.activeDayPassSalesPerMonth
    : assumptions.dayPassSalesPerMonth;

  // Build a "current" KPI snapshot from live data
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
    source: live.source,
  };

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

      {/* Current KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="Active Weekly Subscribers" value={fmtNumber(current.activeWeeklySubscribers)} accent="emerald" />
        <KpiCard title="New Subscribers" value={`+${fmtNumber(current.newSubscribers)}`} accent="emerald" />
        <KpiCard title="Lost Subscribers" value={`-${fmtNumber(current.lostSubscribers)}`} accent="red" />
        <KpiCard title="Churn Rate" value={fmtPct(current.churnPct)} accent={current.churnPct > 10 ? 'red' : 'amber'} />
        <KpiCard title="MRR" value={fmtNZD(current.mrr)} accent="emerald" />
        <KpiCard title="ARR" value={fmtNZD(current.arr)} accent="emerald" />
        <KpiCard title="Revenue / Subscriber" value={fmtNZD(current.revenuePerSubscriber)} accent="blue" />
        <KpiCard title="Day Pass Sales" value={fmtNumber(current.dayPassSales)} accent="blue" />
        <KpiCard title="Radio Listeners" value={fmtNumber(current.radioListeners)} accent="amber" />
        <KpiCard title="Telegram Members" value={fmtNumber(current.telegramMembers)} accent="amber" />
        <KpiCard title="Social Views" value={fmtNumber(current.socialViews)} accent="amber" />
        <KpiCard title="Content → Sub Conversion" value={fmtPct(current.contentToSubConversion)} accent="blue" />
        <KpiCard title="AI Cost / Subscriber" value={fmtNZD(current.aiCostPerSubscriber)} />
        <KpiCard title="Hosting Cost / Subscriber" value={fmtNZD(current.hostingCostPerSubscriber)} />
        <KpiCard title="Content Spend / Subscriber" value={fmtNZD(current.contentSpendPerSubscriber)} />
      </div>

      {/* Monthly KPI Table */}
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
                <th className="text-right py-2 px-3">Radio</th>
                <th className="text-right py-2 px-3">Telegram</th>
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
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtNumber(kpi.radioListeners)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtNumber(kpi.telegramMembers)}</td>
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
