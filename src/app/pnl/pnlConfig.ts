import type { MonthlyForecast } from '@/lib/types';

type PnlLineStyle = 'header' | 'revenue' | 'expense' | 'total' | 'profit' | 'spacer';

export interface PnlLine {
  label: string;
  values: (month: MonthlyForecast) => number;
  style: PnlLineStyle;
}

export const PNL_STRUCTURE: PnlLine[] = [
  { label: 'REVENUE', values: () => 0, style: 'header' },
  { label: 'Weekly Subscriptions', values: (m) => m.weeklySubRevenue, style: 'revenue' },
  { label: 'Day Passes', values: (m) => m.dayPassRevenue, style: 'revenue' },
  { label: 'Strides - Karaka', values: (m) => m.stridesKarakaRevenue, style: 'revenue' },
  { label: 'Strides - Gold Coast', values: (m) => m.stridesGoldCoastRevenue, style: 'revenue' },
  { label: 'BETMAN Terminals', values: (m) => m.betmanTerminalsRevenue, style: 'revenue' },
  { label: 'BETMAN Radio Advertising', values: (m) => m.radioAdRevenue, style: 'revenue' },
  { label: 'Sponsorships', values: (m) => m.sponsorshipRevenue, style: 'revenue' },
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

export function cellClass(style: PnlLineStyle, value?: number): string {
  if (style === 'header') return 'text-slate-400 text-xs font-bold uppercase tracking-widest';
  if (style === 'total') return 'font-bold text-slate-100';
  if (style === 'profit') {
    if (value === undefined) return 'text-slate-300';
    return value >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';
  }
  if (style === 'expense') return 'text-slate-400';
  return 'text-slate-300';
}
