import { getAssumptions } from '@/data/store';
import { buildMonthlyForecast, fmtNZD, fmtNumber, fmtPct } from '@/lib/calculations';
import { MILESTONES } from '@/lib/types';
import { PageTitle } from '@/components/MetricCard';
import MilestoneProgressBar from '@/components/MilestoneProgressBar';

export const dynamic = 'force-dynamic';

export default function ScoreboardPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const current = forecast[0];
  const latestSubs = current.activeWeeklySubscribers;

  return (
    <div>
      <PageTitle subtitle="Monthly subscriber forecast and milestone tracking">
        Subscriber Scoreboard
      </PageTitle>

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8 text-center">
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">
          Active Weekly Subscribers
        </p>
        <p className="text-7xl lg:text-8xl font-black text-emerald-400 tabular-nums">
          {fmtNumber(latestSubs)}
        </p>
        <p className="text-slate-400 text-sm mt-2">As at Month 1</p>
      </div>

      {/* Milestone Progress Bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-slate-200 text-lg font-bold mb-6">Milestone Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MILESTONES.map((m) => (
            <MilestoneProgressBar
              key={m}
              label={`${fmtNumber(m)} Subscribers`}
              current={latestSubs}
              target={m}
            />
          ))}
        </div>
      </div>

      {/* Monthly Forecast Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly Subscriber Forecast</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Opening</th>
                <th className="text-right py-2 px-3">New</th>
                <th className="text-right py-2 px-3">Lost</th>
                <th className="text-right py-2 px-3">Ending</th>
                <th className="text-right py-2 px-3">Growth %</th>
                <th className="text-right py-2 px-3">MRR</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((m) => (
                <tr key={m.month} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                  <td className="py-2 px-3 text-slate-300 font-medium">{m.monthLabel}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                    {fmtNumber(m.openingSubscribers)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                    +{fmtNumber(m.newSubscribers)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-red-400">
                    -{fmtNumber(m.lostSubscribers)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400 font-bold">
                    {fmtNumber(m.endingSubscribers)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums ${
                      m.growthPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {m.growthPct > 0 ? '+' : ''}{fmtPct(m.growthPct)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-blue-400">
                    {fmtNZD(m.weeklySubRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
