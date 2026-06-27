import { getAssumptions } from '@/data/store';
import {
  buildMonthlyForecast,
  buildDashboardSummary,
  fmtNZD,
  fmtNumber,
} from '@/lib/calculations';
import MetricCard, { PageTitle } from '@/components/MetricCard';
import DashboardCharts from './DashboardCharts';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const assumptions = getAssumptions();
  const summary = buildDashboardSummary(assumptions);
  const forecast = buildMonthlyForecast(assumptions);

  const currentMonth = forecast[0];
  const latestMonth = forecast[forecast.length - 1];

  const profitColor: 'green' | 'red' = currentMonth.operatingProfit >= 0 ? 'green' : 'red';

  return (
    <div>
      <PageTitle subtitle="Company Mission Control">BETMAN HQ</PageTitle>

      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-2">
          <MetricCard
            title="Active Weekly Subscribers"
            value={fmtNumber(summary.activeWeeklySubscribers)}
            subtitle={
              summary.nextMilestone
                ? `${fmtNumber(summary.subscribersToGo!)} subscribers to next milestone (${fmtNumber(summary.nextMilestone)})`
                : 'Maximum milestone reached'
            }
            accent="green"
            size="hero"
            badge="CURRENT"
          />
        </div>
        <div className="flex flex-col gap-4">
          <MetricCard
            title="Next Milestone"
            value={summary.nextMilestone ? fmtNumber(summary.nextMilestone) : '—'}
            subtitle="Active Weekly Subscribers"
            accent="gold"
            size="lg"
          />
          <MetricCard
            title="Subscribers to Go"
            value={summary.subscribersToGo !== null ? fmtNumber(summary.subscribersToGo) : '—'}
            accent="blue"
            size="md"
          />
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard title="MRR" value={fmtNZD(summary.mrr)} accent="green" />
        <MetricCard title="ARR" value={fmtNZD(summary.arr)} accent="green" />
        <MetricCard title="Monthly Revenue" value={fmtNZD(summary.monthlyRevenue)} accent="green" />
        <MetricCard
          title="Monthly Operating Profit"
          value={fmtNZD(summary.monthlyOperatingProfit)}
          accent={profitColor}
        />
      </div>

      {/* Position Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Cash Position"
          value={fmtNZD(summary.cashPosition)}
          accent={summary.cashPosition >= 0 ? 'green' : 'red'}
        />
        <MetricCard
          title="Current Founder Salary (Each)"
          value={
            summary.currentSalaryTier.monthlyPerFounder < 0
              ? 'Board Review'
              : fmtNZD(summary.currentSalaryTier.monthlyPerFounder) + '/mo'
          }
          subtitle={summary.currentSalaryTier.label}
          accent="gold"
        />
        <MetricCard
          title="Next Salary Unlock"
          value={
            summary.nextSalaryTier
              ? fmtNumber(summary.nextSalaryTier.minSubscribers) + ' subs'
              : 'Max Tier'
          }
          subtitle={
            summary.nextSalaryTier
              ? `Unlocks ${fmtNZD(summary.nextSalaryTier.monthlyPerFounder)}/mo each`
              : 'All tiers unlocked'
          }
          accent="blue"
        />
      </div>

      {/* Charts */}
      <DashboardCharts forecast={forecast} />

      {/* 12-Month Summary Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
        <h2 className="text-slate-200 text-lg font-bold mb-4">12-Month Forecast Summary</h2>
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
