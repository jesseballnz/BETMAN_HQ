import { getAssumptions } from '@/data/store';
import { buildMonthlyForecast, getSalaryTier, fmtNZD, fmtNumber } from '@/lib/calculations';
import { SALARY_TIERS } from '@/lib/types';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

const FOUNDERS = ['Jesse', 'Dev', 'Bobby'] as const;

export default function SalaryPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const currentSubs = forecast[0].activeWeeklySubscribers;
  const currentTier = getSalaryTier(currentSubs);

  return (
    <div>
      <PageTitle subtitle="Salary unlocks driven by Active Weekly Subscribers">
        Founder Salary Ladder
      </PageTitle>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {FOUNDERS.map((founder) => (
          <div key={founder} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              {founder}
            </p>
            <p className="text-4xl font-black text-amber-400 mb-1">
              {currentTier.monthlyPerFounder < 0
                ? 'Board Review'
                : fmtNZD(currentTier.monthlyPerFounder)}
            </p>
            <p className="text-slate-500 text-xs">per month</p>
          </div>
        ))}
      </div>

      {/* Salary Tiers Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Salary Tiers</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Subscribers</th>
                <th className="text-right py-2 px-3">Per Founder / Month</th>
                <th className="text-right py-2 px-3">Total (3 Founders)</th>
                <th className="text-right py-2 px-3">Annual (Each)</th>
                <th className="text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {SALARY_TIERS.map((tier) => {
                const isActive = tier === currentTier;
                const isUnlocked = currentSubs >= tier.minSubscribers;
                const perFounder = tier.monthlyPerFounder < 0 ? 8000 : tier.monthlyPerFounder;
                return (
                  <tr
                    key={tier.minSubscribers}
                    className={`border-b border-gray-800 text-sm ${
                      isActive ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : 'hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="py-3 px-3 text-slate-200 font-medium">{tier.label}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-amber-400 font-bold">
                      {tier.monthlyPerFounder < 0 ? 'Board Review' : fmtNZD(tier.monthlyPerFounder)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-300">
                      {tier.monthlyPerFounder < 0 ? '—' : fmtNZD(3 * tier.monthlyPerFounder)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-400">
                      {tier.monthlyPerFounder < 0 ? '—' : fmtNZD(perFounder * 12)}
                    </td>
                    <td className="py-3 px-3">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                          ← CURRENT
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-emerald-600 text-xs">✓ Unlocked</span>
                      ) : (
                        <span className="text-slate-600 text-xs">
                          🔒 Need {fmtNumber(tier.minSubscribers - currentSubs)} more subscribers
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Salary Forecast */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly Salary Forecast</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Subscribers</th>
                <th className="text-right py-2 px-3">Tier</th>
                <th className="text-right py-2 px-3">Per Founder</th>
                <th className="text-right py-2 px-3">Total Salaries</th>
              </tr>
            </thead>
            <tbody>
              {forecast.map((m) => (
                <tr key={m.month} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                  <td className="py-2 px-3 text-slate-300 font-medium">{m.monthLabel}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                    {fmtNumber(m.activeWeeklySubscribers)}
                  </td>
                  <td className="py-2 px-3 text-right text-slate-400 text-xs">
                    {m.salaryTierLabel}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-amber-400 font-bold">
                    {fmtNZD(m.currentSalaryPerFounder)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                    {fmtNZD(m.founderSalariesExpense)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 font-bold text-sm">
                <td className="py-2 px-3 text-slate-200">Annual Total</td>
                <td />
                <td />
                <td />
                <td className="py-2 px-3 text-right tabular-nums text-slate-200">
                  {fmtNZD(forecast.reduce((s, m) => s + m.founderSalariesExpense, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
