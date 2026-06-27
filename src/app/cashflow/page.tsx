import { getAssumptions } from '@/data/store';
import { buildMonthlyForecast, buildCashFlow, fmtNZD } from '@/lib/calculations';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

export default function CashFlowPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const cashFlow = buildCashFlow(forecast);

  const totalRevenue = cashFlow.reduce((s, m) => s + m.revenueReceived, 0);
  const totalExpenses = cashFlow.reduce((s, m) => s + m.expensesPaid, 0);
  const totalOpCF = cashFlow.reduce((s, m) => s + m.operatingCashFlow, 0);
  const totalTent = cashFlow.reduce((s, m) => s + m.tentFunding, 0);
  const finalCash = cashFlow[cashFlow.length - 1].closingCash;

  return (
    <div>
      <PageTitle subtitle="12-Month Cash Flow Forecast">Cash Flow</PageTitle>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Annual Revenue Received
          </p>
          <p className="text-2xl font-black text-emerald-400">{fmtNZD(totalRevenue)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Annual Expenses Paid
          </p>
          <p className="text-2xl font-black text-red-400">{fmtNZD(totalExpenses)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Annual TENT Funding
          </p>
          <p className="text-2xl font-black text-amber-400">{fmtNZD(totalTent)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Year-End Cash
          </p>
          <p className={`text-2xl font-black ${finalCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtNZD(finalCash)}
          </p>
        </div>
      </div>

      {/* Cash Flow Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly Cash Flow Statement</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Opening Cash</th>
                <th className="text-right py-2 px-3">Revenue Received</th>
                <th className="text-right py-2 px-3">Expenses Paid</th>
                <th className="text-right py-2 px-3">Op. Cash Flow</th>
                <th className="text-right py-2 px-3">TENT Funding</th>
                <th className="text-right py-2 px-3">Closing Cash</th>
                <th className="text-right py-2 px-3">Runway (mo)</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((row, i) => (
                <tr
                  key={row.month}
                  className="border-b border-gray-800 hover:bg-gray-800/50 text-sm"
                >
                  <td className="py-2 px-3 text-slate-300 font-medium">
                    {forecast[i].monthLabel}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                    {fmtNZD(row.openingCash)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                    {fmtNZD(row.revenueReceived)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-red-400">
                    ({fmtNZD(row.expensesPaid)})
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums font-semibold ${
                      row.operatingCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(row.operatingCashFlow)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-amber-400">
                    {row.tentFunding > 0 ? fmtNZD(row.tentFunding) : '—'}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums font-bold ${
                      row.closingCash >= 0 ? 'text-slate-100' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(row.closingCash)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-blue-400">
                    {row.runway > 0 ? row.runway.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 font-bold text-sm">
                <td className="py-2 px-3 text-slate-200">Annual</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                  {fmtNZD(cashFlow[0].openingCash)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                  {fmtNZD(totalRevenue)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-red-400">
                  ({fmtNZD(totalExpenses)})
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    totalOpCF >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {fmtNZD(totalOpCF)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-amber-400">
                  {fmtNZD(totalTent)}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    finalCash >= 0 ? 'text-slate-100' : 'text-red-400'
                  }`}
                >
                  {fmtNZD(finalCash)}
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
