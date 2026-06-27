// ─── Assumptions ───────────────────────────────────────────────────────────────

export interface Assumptions {
  weeklyPassPriceNZD: number;       // NZ$9.95/week
  dayPassPriceNZD: number;          // NZ$7.95/day
  month1Subscribers: number;        // 75
  month2Subscribers: number;        // 300
  month3Subscribers: number;        // 1000
  month12Subscribers: number;       // 10000
  baseHostingAiElevenLabsNZD: number; // 2000/month
  radioAdRevenue: number;           // monthly radio ad revenue
  sponsorshipRevenue: number;       // monthly sponsorship
  dayPassSalesPerMonth: number;     // avg day passes per month
  contentCommunityNZD: number;      // Content & Community monthly
  administrationNZD: number;        // Administration monthly
  softwareNZD: number;              // Software monthly
  insuranceNZD: number;             // Insurance monthly
  professionalFeesNZD: number;      // Professional fees monthly
  openingCashNZD: number;           // Opening cash balance
  tentOpeningBalanceNZD: number;    // TENT opening balance
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  weeklyPassPriceNZD: 9.95,
  dayPassPriceNZD: 7.95,
  month1Subscribers: 75,
  month2Subscribers: 300,
  month3Subscribers: 1000,
  month12Subscribers: 10000,
  baseHostingAiElevenLabsNZD: 2000,
  radioAdRevenue: 500,
  sponsorshipRevenue: 1000,
  dayPassSalesPerMonth: 50,
  contentCommunityNZD: 1500,
  administrationNZD: 500,
  softwareNZD: 300,
  insuranceNZD: 200,
  professionalFeesNZD: 500,
  openingCashNZD: 5000,
  tentOpeningBalanceNZD: 20000,
};

// ─── Salary Tier ───────────────────────────────────────────────────────────────

export interface SalaryTier {
  minSubscribers: number;
  maxSubscribers: number | null;
  monthlyPerFounder: number;
  label: string;
}

export const SALARY_TIERS: SalaryTier[] = [
  { minSubscribers: 0,    maxSubscribers: 499,   monthlyPerFounder: 0,     label: '0–499 subscribers' },
  { minSubscribers: 500,  maxSubscribers: 999,   monthlyPerFounder: 1000,  label: '500 subscribers' },
  { minSubscribers: 1000, maxSubscribers: 1999,  monthlyPerFounder: 2000,  label: '1,000 subscribers' },
  { minSubscribers: 2000, maxSubscribers: 2999,  monthlyPerFounder: 3500,  label: '2,000 subscribers' },
  { minSubscribers: 3000, maxSubscribers: 4999,  monthlyPerFounder: 5000,  label: '3,000 subscribers' },
  { minSubscribers: 5000, maxSubscribers: 7499,  monthlyPerFounder: 6500,  label: '5,000 subscribers' },
  { minSubscribers: 7500, maxSubscribers: 9999,  monthlyPerFounder: 8000,  label: '7,500 subscribers' },
  { minSubscribers: 10000, maxSubscribers: null, monthlyPerFounder: -1,    label: '10,000+ (Board Review)' },
];

// ─── Milestones ────────────────────────────────────────────────────────────────

export const MILESTONES = [500, 1000, 2000, 3000, 5000, 7500, 10000] as const;
export type Milestone = typeof MILESTONES[number];

// ─── Monthly Forecast Row ──────────────────────────────────────────────────────

export interface MonthlyForecast {
  month: number;              // 1–12
  monthLabel: string;         // "Jan", "Feb", ...
  openingSubscribers: number;
  newSubscribers: number;
  lostSubscribers: number;
  endingSubscribers: number;
  activeWeeklySubscribers: number;
  growthPct: number;
  weeklySubRevenue: number;
  dayPassRevenue: number;
  radioAdRevenue: number;
  sponsorshipRevenue: number;
  totalRevenue: number;
  // Expenses
  hostingAiElevenLabsExpense: number;
  contentCommunityExpense: number;
  administrationExpense: number;
  softwareExpense: number;
  insuranceExpense: number;
  professionalFeesExpense: number;
  founderSalariesExpense: number;
  totalExpenses: number;
  // Profitability
  operatingProfit: number;
  ebitda: number;
  netProfit: number;
  // Cash
  openingCash: number;
  tentFunding: number;
  closingCash: number;
  runway: number;
  // Salary
  currentSalaryPerFounder: number;
  salaryTierLabel: string;
}

// ─── PnL ──────────────────────────────────────────────────────────────────────

export interface PnLRow {
  label: string;
  values: number[];  // monthly values
  quarterly: number[];
  annual: number;
  isTotal?: boolean;
  isNegative?: boolean;
}

// ─── Cash Flow ─────────────────────────────────────────────────────────────────

export interface CashFlowRow {
  month: number;
  openingCash: number;
  revenueReceived: number;
  expensesPaid: number;
  operatingCashFlow: number;
  tentFunding: number;
  closingCash: number;
  runway: number;
}

// ─── TENT ──────────────────────────────────────────────────────────────────────

export interface TentRow {
  month: number;
  monthLabel: string;
  openingBalance: number;
  bettingProfitLoss: number;
  transfersToOperations: number;
  strategicInvestment: number;
  closingBalance: number;
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

export interface KPISnapshot {
  month: number;
  monthLabel: string;
  activeWeeklySubscribers: number;
  newSubscribers: number;
  lostSubscribers: number;
  churnPct: number;
  mrr: number;
  arr: number;
  revenuePerSubscriber: number;
  dayPassSales: number;
  radioListeners: number;
  telegramMembers: number;
  socialViews: number;
  contentToSubConversion: number;
  aiCostPerSubscriber: number;
  hostingCostPerSubscriber: number;
  contentSpendPerSubscriber: number;
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export interface DashboardSummary {
  activeWeeklySubscribers: number;
  nextMilestone: number | null;
  subscribersToGo: number | null;
  mrr: number;
  arr: number;
  monthlyRevenue: number;
  monthlyOperatingProfit: number;
  cashPosition: number;
  currentSalaryTier: SalaryTier;
  nextSalaryTier: SalaryTier | null;
  monthlyForecast: MonthlyForecast[];
}
