import { getAssumptions } from '@/data/store';
import { getLiveSubscriberCounts } from '@/data/liveCounts';
import {
  buildMonthlyForecast,
  getSalaryTier,
  getNextSalaryTier,
  getNextMilestone,
  calcWeeklySubRevenue,
  calcDayPassRevenue,
  calcTotalExpenses,
  fmtNZD,
  fmtNumber,
} from '@/lib/calculations';
import MetricCard, { PageTitle } from '@/components/MetricCard';
import DashboardCharts from './DashboardCharts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const assumptions = getAssumptions();

  // Live subscriber count from Stripe (falls back to assumptions if Stripe not configured)
  const live = await getLiveSubscriberCounts();
  const currentSubs = live.activeWeeklySubscribers;

  // Build 12-month forecast using assumptions (used for charts and projections)
  const forecast = buildMonthlyForecast(assumptions);
  const latestMonth = forecast[forecast.length - 1];

  // Current-period metrics derived from the live Stripe subscriber count
  const currentTier = getSalaryTier(currentSubs);
  const nextTier = getNextSalaryTier(currentSubs);
  const nextMilestone = getNextMilestone(currentSubs);
  const dayPassSales = live.activeDayPassSalesPerMonth > 0
    ? live.activeDayPassSalesPerMonth
    : assumptions.dayPassSalesPerMonth;

  const mrr = calcWeeklySubRevenue(currentSubs, assumptions.weeklyPassPriceNZD);
  const monthlyRevenue =
    mrr +
    calcDayPassRevenue(dayPassSales, assumptions.dayPassPriceNZD) +
    assumptions.radioAdRevenue +
    assumptions.sponsorshipRevenue;
  const totalExpenses = calcTotalExpenses(currentSubs, assumptions);
  const operatingProfit = monthlyRevenue - totalExpenses;
  const cashPosition = assumptions.openingCashNZD + operatingProfit;

  const profitColor: 'green' | 'red' = operatingProfit >= 0 ? 'green' : 'red';

  return (
    <div>
      <PageTitle subtitle="Company Mission Control">BETMAN HQ</PageTitle>

      {/* Live data source badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${
        live.source === 'stripe'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${live.source === 'stripe' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
        {live.source === 'stripe'
          ? `Live from Stripe · Updated ${new Date(live.fetchedAt).toLocaleTimeString()}`
          : 'Demo data · Connect Stripe to see live subscriber counts'}
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2">
          <MetricCard
            title="Active Weekly Subscribers"
            value={fmtNumber(currentSubs)}
            subtitle={
              nextMilestone
                ? `${fmtNumber(nextMilestone - currentSubs)} subscribers to next milestone (${fmtNumber(nextMilestone)})`
                : 'Maximum milestone reached'
            }
            accent="green"
            size="hero"
            badge={live.source === 'stripe' ? 'LIVE · STRIPE' : 'DEMO'}
          />
        </div>
        <div className="flex flex-col gap-4">
          <MetricCard
            title="Next Milestone"
            value={nextMilestone ? fmtNumber(nextMilestone) : '—'}
            subtitle="Active Weekly Subscribers"
            accent="gold"
            size="lg"
          />
          <MetricCard
            title="Subscribers to Go"
            value={nextMilestone ? fmtNumber(nextMilestone - currentSubs) : '—'}
            accent="blue"
            size="md"
          />
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard title="MRR" value={fmtNZD(mrr)} accent="green" />
        <MetricCard title="ARR" value={fmtNZD(mrr * 12)} accent="green" />
        <MetricCard title="Monthly Revenue" value={fmtNZD(monthlyRevenue)} accent="green" />
        <MetricCard
          title="Monthly Operating Profit"
          value={fmtNZD(operatingProfit)}
          accent={profitColor}
        />
      </div>

      {/* Position Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Cash Position"
          value={fmtNZD(cashPosition)}
          accent={cashPosition >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          title="Current Founder Salary (Each)"
          value={
            currentTier.monthlyPerFounder < 0
              ? 'Board Review'
              : fmtNZD(currentTier.monthlyPerFounder) + '/mo'
          }
          subtitle={currentTier.label}
          accent="gold"
        />
        <MetricCard
          title="Next Salary Unlock"
          value={
            nextTier
              ? fmtNumber(nextTier.minSubscribers) + ' subs'
              : 'Max Tier'
          }
          subtitle={
            nextTier
              ? `Unlocks ${fmtNZD(nextTier.monthlyPerFounder)}/mo each`
              : 'All tiers unlocked'
          }
          accent="blue"
        />
      </div>

      {/* Charts — driven from assumptions-based forecast */}
      <DashboardCharts forecast={forecast} />

      {/* 12-Month Summary Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
        <h2 className="text-slate-200 text-lg font-bold mb-1">12-Month Forecast Summary</h2>
        <p className="text-slate-500 text-xs mb-4">Projections driven from Assumptions page · Current period uses live Stripe count</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Subscribers</th>
                <th className="text-right py-2 px-3">Revenue</th>
                <th className="text-right py-2 px-3">Expenses</th>
                <th className="text-right py-2 px-3">Op. Profit</th>
                <th className="text-right py-2 px-3">Cash</th>
                <th className="text-right py-2 px-3">Salary Tier</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((m) => (
                <tr key={m.month} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                  <td className="py-2 px-3 text-slate-300">{m.monthLabel}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                    {fmtNumber(m.activeWeeklySubscribers)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-200">
                    {fmtNZD(m.totalRevenue)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                    {fmtNZD(m.totalExpenses)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums font-semibold ${
                      m.operatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(m.operatingProfit)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums ${
                      m.closingCash >= 0 ? 'text-slate-300' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(m.closingCash)}
                  </td>
                  <td className="py-2 px-3 text-right text-amber-400 text-xs">
                    {m.salaryTierLabel}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 font-bold text-sm">
                <td className="py-2 px-3 text-slate-200">Annual Total</td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                  {fmtNumber(latestMonth.activeWeeklySubscribers)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-200">
                  {fmtNZD(forecast.reduce((s, m) => s + m.totalRevenue, 0))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                  {fmtNZD(forecast.reduce((s, m) => s + m.totalExpenses, 0))}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    forecast.reduce((s, m) => s + m.operatingProfit, 0) >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {fmtNZD(forecast.reduce((s, m) => s + m.operatingProfit, 0))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                  {fmtNZD(latestMonth.closingCash)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
