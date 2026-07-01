import { getAssumptions } from '@/data/store';
import { getLiveSubscriberCounts } from '@/data/liveCounts';
import { buildMonthlyForecast, fmtNZD, quarterlySum } from '@/lib/calculations';
import { PageTitle } from '@/components/MetricCard';
import { MonthlyPnLTable } from './MonthlyPnLTable';
import { PNL_STRUCTURE, cellClass } from './pnlConfig';

export const dynamic = 'force-dynamic';

const QUARTERS = ['Q1 (Jun–Aug)', 'Q2 (Sep–Nov)', 'Q3 (Dec–Feb)', 'Q4 (Mar–May)'];

export default async function PnLPage() {
  const assumptions = await getAssumptions();
  const live = await getLiveSubscriberCounts();
  const growthTargetForecast = buildMonthlyForecast(assumptions);
  const forecast = buildMonthlyForecast(
    assumptions,
    live.source === 'stripe'
      ? {
          activeWeeklySubscribers: live.activeWeeklySubscribers,
          dayPassSalesPerMonth: live.activeDayPassSalesPerMonth,
        }
      : undefined,
  );

  return (
    <div>
      <PageTitle subtitle="Profit & Loss Statement — 12-Month Forecast">
        Profit &amp; Loss
      </PageTitle>

      <MonthlyPnLTable
        assumptions={assumptions}
        fallbackSubscribers={growthTargetForecast.map((month) => month.activeWeeklySubscribers)}
        forecast={forecast}
        live={live}
      />

      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 ${
        live.source === 'stripe'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${live.source === 'stripe' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
        {live.source === 'stripe'
          ? `June actuals from Stripe · ${live.payingCustomers} paying customer${live.payingCustomers === 1 ? '' : 's'} · ${live.totalProvisionings} provisionings · ${live.uniqueAccounts} Core accounts`
          : 'Using assumptions until Stripe data is available'}
      </div>

      {/* Quarterly P&L */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Quarterly Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3 w-52">Item</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="text-right py-2 px-3 min-w-[120px]">
                    {q}
                  </th>
                ))}
                <th className="text-right py-2 px-3 text-slate-300 font-bold">Annual</th>
              </tr>
            </thead>
            <tbody>
              {PNL_STRUCTURE.filter((l) => l.style !== 'header' && l.style !== 'spacer').map(
                (line, i) => {
                  const allValues = forecast.map((m) => line.values(m));
                  const qValues = quarterlySum(allValues);
                  const annual = allValues.reduce((a, b) => a + b, 0);

                  return (
                    <tr key={i} className={`border-b border-gray-800 text-sm hover:bg-gray-800/30 ${line.style === 'total' ? 'border-t border-gray-700 bg-gray-800/30' : ''}`}>
                      <td className={`py-2 px-3 ${cellClass(line.style)}`}>{line.label}</td>
                      {qValues.map((v, j) => (
                        <td key={j} className={`py-2 px-3 text-right tabular-nums ${cellClass(line.style, v)}`}>
                          {v !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(v) : '—'}
                        </td>
                      ))}
                      <td className={`py-2 px-3 text-right tabular-nums font-semibold ${cellClass(line.style, annual)}`}>
                        {annual !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(annual) : '—'}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
