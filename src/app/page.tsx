import { getAssumptions } from '@/data/store';
import { getLiveSubscriberCounts } from '@/data/liveCounts';
import {
  fetchBetmanHealth,
  fetchTodaysMeetings,
  isBetmanApiConfigured,
  BetmanHealth,
  BetmanMeeting,
} from '@/lib/betmanApi';
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
  const assumptions = await getAssumptions();

  // Parallel data fetches
  const [live, betmanHealth, todaysMeetings] = await Promise.allSettled([
    getLiveSubscriberCounts(),
    isBetmanApiConfigured() ? fetchBetmanHealth() : Promise.resolve(null),
    isBetmanApiConfigured() ? fetchTodaysMeetings() : Promise.resolve([]),
  ]);

  const liveData = live.status === 'fulfilled'
    ? live.value
    : {
        activeWeeklySubscribers: 0,
        activeDayPassSalesPerMonth: 0,
        payingCustomers: 0,
        totalProvisionings: 0,
        uniqueAccounts: 0,
        activeAccounts: 0,
        passwordPendingAccounts: 0,
        source: 'assumptions' as const,
        accountSource: 'unavailable' as const,
        isLive: false,
        fetchedAt: new Date().toISOString(),
      };
  const health: BetmanHealth | null = betmanHealth.status === 'fulfilled' ? betmanHealth.value : null;
  const meetings: BetmanMeeting[] = todaysMeetings.status === 'fulfilled' ? (todaysMeetings.value ?? []) : [];

  const payingCustomers = liveData.payingCustomers;
  const currentSubs = liveData.activeWeeklySubscribers;
  const forecast = buildMonthlyForecast(
    assumptions,
    liveData.source === 'stripe'
      ? {
          activeWeeklySubscribers: liveData.activeWeeklySubscribers,
          dayPassSalesPerMonth: liveData.activeDayPassSalesPerMonth,
        }
      : undefined,
  );
  const latestMonth = forecast[forecast.length - 1];

  const currentTier = getSalaryTier(currentSubs);
  const nextTier = getNextSalaryTier(currentSubs);
  const nextMilestone = getNextMilestone(payingCustomers);
  const dayPassSales = liveData.source === 'stripe'
    ? liveData.activeDayPassSalesPerMonth
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
  const today = new Date().toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <PageTitle subtitle="Company Mission Control">BETMAN HQ</PageTitle>

      {/* Status bar — Stripe + BETMAN_DATA platform health */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          liveData.source === 'stripe'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${liveData.source === 'stripe' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
          {liveData.source === 'stripe' ? 'Stripe · Live paying customers' : 'Stripe · Demo mode'}
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
          liveData.accountSource === 'core'
            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
            : 'bg-slate-700/50 text-slate-400 border border-slate-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${liveData.accountSource === 'core' ? 'bg-blue-300' : 'bg-slate-500'}`} />
          {liveData.accountSource === 'core' ? 'Core Auth · Live accounts' : 'Core Auth · Not configured'}
        </div>

        {/* BETMAN_DATA platform health */}
        {health !== null && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
            health.status === 'ok'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'}`} />
            BETMAN Platform · {health.status === 'ok' ? `Online v${health.version}` : health.status}
          </div>
        )}
        {!isBetmanApiConfigured() && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            BETMAN Platform · Not configured
          </div>
        )}
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2">
          <MetricCard
            title="Unique Accounts"
            value={fmtNumber(liveData.uniqueAccounts)}
            subtitle={
              nextMilestone
                ? `${fmtNumber(nextMilestone - payingCustomers)} paid customers to next revenue milestone (${fmtNumber(nextMilestone)})`
                : 'Maximum revenue milestone reached'
            }
            accent="green"
            size="hero"
            badge={liveData.accountSource === 'core' ? 'LIVE · CORE' : 'UNAVAILABLE'}
          />
        </div>
        <div className="flex flex-col gap-4">
          <MetricCard
            title="Paying Customers"
            value={fmtNumber(liveData.payingCustomers)}
            subtitle={liveData.source === 'stripe' ? 'Live Stripe paid customers' : 'Demo subscriber count'}
            accent="gold"
            size="lg"
          />
          <MetricCard
            title="Provisionings"
            value={fmtNumber(liveData.totalProvisionings)}
            subtitle={`${fmtNumber(liveData.passwordPendingAccounts)} accounts pending setup`}
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
        <MetricCard title="Monthly Operating Profit" value={fmtNZD(operatingProfit)} accent={profitColor} />
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
          value={currentTier.monthlyPerFounder < 0 ? 'Board Review' : fmtNZD(currentTier.monthlyPerFounder) + '/mo'}
          subtitle={currentTier.label}
          accent="gold"
        />
        <MetricCard
          title="Next Salary Unlock"
          value={nextTier ? fmtNumber(nextTier.minSubscribers) + ' subs' : 'Max Tier'}
          subtitle={nextTier ? `Unlocks ${fmtNZD(nextTier.monthlyPerFounder)}/mo each` : 'All tiers unlocked'}
          accent="blue"
        />
      </div>

      {/* Charts */}
      <DashboardCharts forecast={forecast} />

      {/* Today's Race Day — from BETMAN_DATA API */}
      {meetings.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-slate-200 text-lg font-bold">Today&apos;s Race Day</h2>
            <span className="text-slate-500 text-xs">{today}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-slate-100 font-bold text-sm">{meeting.track_name}</p>
                  <span className="text-xs text-slate-500 uppercase">{meeting.jurisdiction}</span>
                </div>
                <p className="text-slate-500 text-xs capitalize">{meeting.surface}</p>
                {meeting.races && (
                  <p className="text-emerald-400 text-xs mt-1">{meeting.races.length} races</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-3">Source: BETMAN_DATA platform</p>
        </div>
      )}

      {/* 12-Month Summary Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
        <h2 className="text-slate-200 text-lg font-bold mb-1">12-Month Forecast Summary</h2>
        <p className="text-slate-500 text-xs mb-4">Projections from Assumptions · Current period from Stripe</p>
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
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">{fmtNumber(m.activeWeeklySubscribers)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-200">{fmtNZD(m.totalRevenue)}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtNZD(m.totalExpenses)}</td>
                  <td className={`py-2 px-3 text-right tabular-nums font-semibold ${m.operatingProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtNZD(m.operatingProfit)}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums ${m.closingCash >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                    {fmtNZD(m.closingCash)}
                  </td>
                  <td className="py-2 px-3 text-right text-amber-400 text-xs">{m.salaryTierLabel}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 font-bold text-sm">
                <td className="py-2 px-3 text-slate-200">Annual Total</td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-400">{fmtNumber(latestMonth.activeWeeklySubscribers)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-200">{fmtNZD(forecast.reduce((s, m) => s + m.totalRevenue, 0))}</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-400">{fmtNZD(forecast.reduce((s, m) => s + m.totalExpenses, 0))}</td>
                <td className={`py-2 px-3 text-right tabular-nums ${forecast.reduce((s, m) => s + m.operatingProfit, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtNZD(forecast.reduce((s, m) => s + m.operatingProfit, 0))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-300">{fmtNZD(latestMonth.closingCash)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
