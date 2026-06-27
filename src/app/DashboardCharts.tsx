'use client';

import BetmanChart from '@/components/BetmanChart';
import { MonthlyForecast } from '@/lib/types';
import { fmtNZD } from '@/lib/calculations';

interface Props {
  forecast: MonthlyForecast[];
}

export default function DashboardCharts({ forecast }: Props) {
  const subData = forecast.map((m) => ({ label: m.monthLabel, value: m.activeWeeklySubscribers }));
  const revenueData = forecast.map((m) => ({ label: m.monthLabel, value: m.totalRevenue }));
  const profitData = forecast.map((m) => ({ label: m.monthLabel, value: m.operatingProfit }));
  const cashData = forecast.map((m) => ({ label: m.monthLabel, value: m.closingCash }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-4">Subscriber Growth</h3>
        <BetmanChart data={subData} type="area" color="#10b981" valueLabel="Subscribers" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-4">Monthly Revenue (NZD)</h3>
        <BetmanChart
          data={revenueData}
          type="area"
          color="#3b82f6"
          valueLabel="Revenue"
          formatValue={(v) => fmtNZD(v)}
        />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-4">Operating Profit (NZD)</h3>
        <BetmanChart
          data={profitData}
          type="bar"
          color="#10b981"
          valueLabel="Profit"
          formatValue={(v) => fmtNZD(v)}
        />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-slate-300 text-sm font-semibold mb-4">Cash Position (NZD)</h3>
        <BetmanChart
          data={cashData}
          type="line"
          color="#f59e0b"
          valueLabel="Cash"
          formatValue={(v) => fmtNZD(v)}
        />
      </div>
    </div>
  );
}
