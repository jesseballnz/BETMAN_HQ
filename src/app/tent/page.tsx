import { getAssumptions } from '@/data/store';
import { buildMonthlyForecast, buildTentForecast, fmtNZD } from '@/lib/calculations';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

export default function TentPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const tent = buildTentForecast(forecast, assumptions);

  const totalBetting = tent.reduce((s, r) => s + r.bettingProfitLoss, 0);
  const totalTransfers = tent.reduce((s, r) => s + r.transfersToOperations, 0);
  const finalBalance = tent[tent.length - 1].closingBalance;

  return (
    <div>
      <PageTitle subtitle="TENT Treasury — Separate from operating revenue">
        TENT Treasury
      </PageTitle>

      {/* Disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8">
        <p className="text-amber-300 text-sm">
          <strong>⚠️ Important:</strong> TENT is the company treasury and is kept strictly separate
          from operating revenue. Betting gains and losses are not treated as operating income.
          TENT may fund strategic growth or bridge operating shortfalls via explicit transfers.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Opening TENT Balance
          </p>
          <p className="text-2xl font-black text-slate-200">
            {fmtNZD(assumptions.tentOpeningBalanceNZD)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Annual Betting P/L
          </p>
          <p className={`text-2xl font-black ${totalBetting >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtNZD(totalBetting)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Transfers to Operations
          </p>
          <p className="text-2xl font-black text-amber-400">{fmtNZD(totalTransfers)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            Year-End TENT Balance
          </p>
          <p className={`text-2xl font-black ${finalBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmtNZD(finalBalance)}
          </p>
        </div>
      </div>

      {/* TENT Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly TENT Statement</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3">Month</th>
                <th className="text-right py-2 px-3">Opening Balance</th>
                <th className="text-right py-2 px-3">Betting P/L</th>
                <th className="text-right py-2 px-3">Transfers Out</th>
                <th className="text-right py-2 px-3">Strategic Inv.</th>
                <th className="text-right py-2 px-3">Closing Balance</th>
              </tr>
            </thead>
            <tbody>
              {tent.map((row) => (
                <tr key={row.month} className="border-b border-gray-800 hover:bg-gray-800/50 text-sm">
                  <td className="py-2 px-3 text-slate-300 font-medium">{row.monthLabel}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                    {fmtNZD(row.openingBalance)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums ${
                      row.bettingProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(row.bettingProfitLoss)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-amber-400">
                    {row.transfersToOperations > 0 ? `(${fmtNZD(row.transfersToOperations)})` : '—'}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                    {row.strategicInvestment > 0 ? `(${fmtNZD(row.strategicInvestment)})` : '—'}
                  </td>
                  <td
                    className={`py-2 px-3 text-right tabular-nums font-bold ${
                      row.closingBalance >= 0 ? 'text-slate-100' : 'text-red-400'
                    }`}
                  >
                    {fmtNZD(row.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-700 font-bold text-sm">
                <td className="py-2 px-3 text-slate-200">Annual</td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-400">
                  {fmtNZD(tent[0].openingBalance)}
                </td>
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    totalBetting >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {fmtNZD(totalBetting)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-amber-400">
                  {fmtNZD(totalTransfers)}
                </td>
                <td />
                <td
                  className={`py-2 px-3 text-right tabular-nums ${
                    finalBalance >= 0 ? 'text-slate-100' : 'text-red-400'
                  }`}
                >
                  {fmtNZD(finalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
