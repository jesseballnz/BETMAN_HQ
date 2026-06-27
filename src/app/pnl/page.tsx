import { getAssumptions } from '@/data/store';
import { buildMonthlyForecast, fmtNZD, quarterlySum } from '@/lib/calculations';
import { MonthlyForecast } from '@/lib/types';
import { PageTitle } from '@/components/MetricCard';

export const dynamic = 'force-dynamic';

type PnLLine = {
  label: string;
  values: (m: MonthlyForecast) => number;
  style: 'revenue' | 'expense' | 'total' | 'profit' | 'header' | 'spacer';
};

const PNL_STRUCTURE: PnLLine[] = [
  { label: 'REVENUE', values: () => 0, style: 'header' },
  { label: 'Weekly Subscriptions', values: (m) => m.weeklySubRevenue, style: 'revenue' },
  { label: 'Day Passes', values: (m) => m.dayPassRevenue, style: 'revenue' },
  { label: 'BETMAN Radio Advertising', values: (m) => m.radioAdRevenue, style: 'revenue' },
  { label: 'Sponsorships', values: (m) => m.sponsorshipRevenue, style: 'revenue' },
  { label: 'Future Revenue', values: () => 0, style: 'revenue' },
  { label: 'Total Revenue', values: (m) => m.totalRevenue, style: 'total' },
  { label: '', values: () => 0, style: 'spacer' },
  { label: 'EXPENSES', values: () => 0, style: 'header' },
  { label: 'Hosting', values: (m) => m.hostingAiElevenLabsExpense * 0.3, style: 'expense' },
  { label: 'AI', values: (m) => m.hostingAiElevenLabsExpense * 0.4, style: 'expense' },
  { label: 'ElevenLabs', values: (m) => m.hostingAiElevenLabsExpense * 0.3, style: 'expense' },
  { label: 'Content & Community', values: (m) => m.contentCommunityExpense, style: 'expense' },
  { label: 'Administration', values: (m) => m.administrationExpense, style: 'expense' },
  { label: 'Software', values: (m) => m.softwareExpense, style: 'expense' },
  { label: 'Insurance', values: (m) => m.insuranceExpense, style: 'expense' },
  { label: 'Professional Fees', values: (m) => m.professionalFeesExpense, style: 'expense' },
  { label: 'Founder Salaries', values: (m) => m.founderSalariesExpense, style: 'expense' },
  { label: 'Total Operating Expenses', values: (m) => m.totalExpenses, style: 'total' },
  { label: '', values: () => 0, style: 'spacer' },
  { label: 'PROFITABILITY', values: () => 0, style: 'header' },
  { label: 'Operating Profit', values: (m) => m.operatingProfit, style: 'profit' },
  { label: 'EBITDA', values: (m) => m.ebitda, style: 'profit' },
  { label: 'Net Profit', values: (m) => m.netProfit, style: 'profit' },
];

function cellClass(style: string, value?: number): string {
  if (style === 'header') return 'text-slate-400 text-xs font-bold uppercase tracking-widest';
  if (style === 'total') return 'font-bold text-slate-100';
  if (style === 'profit') {
    if (value === undefined) return 'text-slate-300';
    return value >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';
  }
  if (style === 'expense') return 'text-slate-400';
  return 'text-slate-300';
}

const QUARTERS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

export default function PnLPage() {
  const assumptions = getAssumptions();
  const forecast = buildMonthlyForecast(assumptions);
  const months = forecast.map((m) => m.monthLabel);

  return (
    <div>
      <PageTitle subtitle="Profit & Loss Statement — 12-Month Forecast">
        Profit &amp; Loss
      </PageTitle>

      {/* Monthly P&L */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-slate-200 text-lg font-bold mb-4">Monthly</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-gray-700">
                <th className="text-left py-2 px-3 w-52">Item</th>
                {months.map((mo) => (
                  <th key={mo} className="text-right py-2 px-2 min-w-[80px]">
                    {mo}
                  </th>
                ))}
                <th className="text-right py-2 px-3 min-w-[90px] text-slate-300 font-bold">
                  Annual
                </th>
              </tr>
            </thead>
            <tbody>
              {PNL_STRUCTURE.map((line, i) => {
                if (line.style === 'spacer') {
                  return <tr key={i} className="h-3" />;
                }
                if (line.style === 'header') {
                  return (
                    <tr key={i} className="border-b border-gray-700">
                      <td colSpan={14} className="py-3 px-3 text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {line.label}
                      </td>
                    </tr>
                  );
                }

                const values = forecast.map((m) => line.values(m));
                const annual = values.reduce((a, b) => a + b, 0);

                return (
                  <tr key={i} className={`border-b border-gray-800 text-sm hover:bg-gray-800/30 ${line.style === 'total' ? 'border-t border-gray-700 bg-gray-800/30' : ''}`}>
                    <td className={`py-2 px-3 ${cellClass(line.style)}`}>{line.label}</td>
                    {values.map((v, j) => (
                      <td key={j} className={`py-2 px-2 text-right tabular-nums ${cellClass(line.style, v)}`}>
                        {v !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(v) : '—'}
                      </td>
                    ))}
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${cellClass(line.style, annual)}`}>
                      {annual !== 0 || line.style === 'total' || line.style === 'profit' ? fmtNZD(annual) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
