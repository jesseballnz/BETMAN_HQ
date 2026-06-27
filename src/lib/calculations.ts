import {
  Assumptions,
  SALARY_TIERS,
  MILESTONES,
  SalaryTier,
  MonthlyForecast,
  CashFlowRow,
  TentRow,
  KPISnapshot,
  DashboardSummary,
} from './types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FORECAST_TARGET_SUBSCRIBERS = 10000;
const FORECAST_TARGET_GROWTH_PCT = 30;
const FORECAST_TARGET_MONTHS_TO_10K = 12;

// ─── Salary Tier ─────────────────────────────────────────────────────────────

export function getSalaryTier(subscribers: number): SalaryTier {
  for (let i = SALARY_TIERS.length - 1; i >= 0; i--) {
    if (subscribers >= SALARY_TIERS[i].minSubscribers) {
      return SALARY_TIERS[i];
    }
  }
  return SALARY_TIERS[0];
}

export function getNextSalaryTier(subscribers: number): SalaryTier | null {
  const current = getSalaryTier(subscribers);
  const idx = SALARY_TIERS.indexOf(current);
  return idx < SALARY_TIERS.length - 1 ? SALARY_TIERS[idx + 1] : null;
}

// ─── Next Milestone ──────────────────────────────────────────────────────────

export function getNextMilestone(subscribers: number): number | null {
  for (const m of MILESTONES) {
    if (subscribers < m) return m;
  }
  return null;
}

// ─── Revenue Calculation ─────────────────────────────────────────────────────

export function calcWeeklySubRevenue(subscribers: number, weeklyPrice: number): number {
  // ~4.33 weeks per month
  return Math.round(subscribers * weeklyPrice * 4.33);
}

export function calcDayPassRevenue(dayPassSales: number, dayPassPrice: number): number {
  return Math.round(dayPassSales * dayPassPrice);
}

export function calcMonthlyRevenue(
  subscribers: number,
  assumptions: Assumptions,
): number {
  return (
    calcWeeklySubRevenue(subscribers, assumptions.weeklyPassPriceNZD) +
    calcDayPassRevenue(assumptions.dayPassSalesPerMonth, assumptions.dayPassPriceNZD) +
    assumptions.radioAdRevenue +
    assumptions.sponsorshipRevenue
  );
}

// ─── Expense Calculation ─────────────────────────────────────────────────────

export function calcFounderSalariesTotal(subscribers: number): number {
  const tier = getSalaryTier(subscribers);
  if (tier.monthlyPerFounder < 0) return 3 * 8000; // board review – use 8k as placeholder
  return 3 * tier.monthlyPerFounder;
}

export function calcTotalExpenses(subscribers: number, assumptions: Assumptions): number {
  return (
    assumptions.baseHostingAiElevenLabsNZD +
    assumptions.contentCommunityNZD +
    assumptions.administrationNZD +
    assumptions.softwareNZD +
    assumptions.insuranceNZD +
    assumptions.professionalFeesNZD +
    calcFounderSalariesTotal(subscribers)
  );
}

// ─── Subscriber Growth Interpolation ─────────────────────────────────────────

function interpolateSubscribers(month: number, assumptions: Assumptions): number {
  const { month1Subscribers, month2Subscribers, month3Subscribers, month12Subscribers } = assumptions;

  if (month === 1) return month1Subscribers;
  if (month === 2) return month2Subscribers;
  if (month === 3) return month3Subscribers;
  if (month === 12) return month12Subscribers;

  // Exponential interpolation between month3 and month12
  if (month > 3 && month < 12) {
    const t = (month - 3) / (12 - 3);
    return Math.round(month3Subscribers + (month12Subscribers - month3Subscribers) * t);
  }

  return month12Subscribers;
}

// ─── Monthly Forecast ─────────────────────────────────────────────────────────

export function buildMonthlyForecast(assumptions: Assumptions): MonthlyForecast[] {
  const months: MonthlyForecast[] = [];
  let openingCash = assumptions.openingCashNZD;

  for (let m = 1; m <= 12; m++) {
    const activeWeekly = interpolateSubscribers(m, assumptions);
    const prevSubs = m === 1 ? 0 : interpolateSubscribers(m - 1, assumptions);

    const newSubs = Math.max(0, activeWeekly - prevSubs);
    const lostSubs = m === 1 ? 0 : Math.round(prevSubs * 0.05); // 5% churn
    const endingSubs = activeWeekly;
    const growthPct = prevSubs > 0 ? ((activeWeekly - prevSubs) / prevSubs) * 100 : 0;

    const weeklySubRevenue = calcWeeklySubRevenue(activeWeekly, assumptions.weeklyPassPriceNZD);
    const dayPassRevenue = calcDayPassRevenue(assumptions.dayPassSalesPerMonth, assumptions.dayPassPriceNZD);
    const radioAdRevenue = assumptions.radioAdRevenue;
    const sponsorshipRevenue = assumptions.sponsorshipRevenue;
    const totalRevenue = weeklySubRevenue + dayPassRevenue + radioAdRevenue + sponsorshipRevenue;

    const hostingAiElevenLabsExpense = assumptions.baseHostingAiElevenLabsNZD;
    const contentCommunityExpense = assumptions.contentCommunityNZD;
    const administrationExpense = assumptions.administrationNZD;
    const softwareExpense = assumptions.softwareNZD;
    const insuranceExpense = assumptions.insuranceNZD;
    const professionalFeesExpense = assumptions.professionalFeesNZD;
    const founderSalariesExpense = calcFounderSalariesTotal(activeWeekly);
    const totalExpenses =
      hostingAiElevenLabsExpense +
      contentCommunityExpense +
      administrationExpense +
      softwareExpense +
      insuranceExpense +
      professionalFeesExpense +
      founderSalariesExpense;

    const operatingProfit = totalRevenue - totalExpenses;
    const ebitda = operatingProfit; // simplified (no D&A)
    const netProfit = operatingProfit; // simplified (no tax/interest)

    const tentFunding = operatingProfit < 0 ? Math.abs(operatingProfit) : 0;
    const closingCash = openingCash + operatingProfit + tentFunding;
    const monthlyBurn = totalExpenses;
    const runway = closingCash > 0 && monthlyBurn > 0 ? closingCash / monthlyBurn : 0;

    const tier = getSalaryTier(activeWeekly);

    months.push({
      month: m,
      monthLabel: MONTH_LABELS[m - 1],
      openingSubscribers: m === 1 ? 0 : prevSubs,
      newSubscribers: newSubs,
      lostSubscribers: lostSubs,
      endingSubscribers: endingSubs,
      activeWeeklySubscribers: activeWeekly,
      growthPct,
      weeklySubRevenue,
      dayPassRevenue,
      radioAdRevenue,
      sponsorshipRevenue,
      totalRevenue,
      hostingAiElevenLabsExpense,
      contentCommunityExpense,
      administrationExpense,
      softwareExpense,
      insuranceExpense,
      professionalFeesExpense,
      founderSalariesExpense,
      totalExpenses,
      operatingProfit,
      ebitda,
      netProfit,
      openingCash,
      tentFunding,
      closingCash,
      runway,
      currentSalaryPerFounder: tier.monthlyPerFounder < 0 ? 8000 : tier.monthlyPerFounder,
      salaryTierLabel: tier.label,
    });

    openingCash = closingCash;
  }

  return months;
}

// ─── Cash Flow ───────────────────────────────────────────────────────────────

export function buildCashFlow(forecast: MonthlyForecast[]): CashFlowRow[] {
  return forecast.map((m) => ({
    month: m.month,
    openingCash: m.openingCash,
    revenueReceived: m.totalRevenue,
    expensesPaid: m.totalExpenses,
    operatingCashFlow: m.operatingProfit,
    tentFunding: m.tentFunding,
    closingCash: m.closingCash,
    runway: m.runway,
  }));
}

// ─── TENT Forecast ───────────────────────────────────────────────────────────

export function buildTentForecast(forecast: MonthlyForecast[], assumptions: Assumptions): TentRow[] {
  const rows: TentRow[] = [];
  let balance = assumptions.tentOpeningBalanceNZD;

  for (const m of forecast) {
    const bettingPL = Math.round(balance * 0.03); // 3% monthly betting return (assumption)
    const transfersOut = m.tentFunding;
    const strategic = 0;
    const closing = balance + bettingPL - transfersOut - strategic;

    rows.push({
      month: m.month,
      monthLabel: m.monthLabel,
      openingBalance: balance,
      bettingProfitLoss: bettingPL,
      transfersToOperations: transfersOut,
      strategicInvestment: strategic,
      closingBalance: closing,
    });

    balance = closing;
  }

  return rows;
}

// ─── KPI Snapshots ───────────────────────────────────────────────────────────

export function buildKpiSnapshots(forecast: MonthlyForecast[], assumptions: Assumptions): KPISnapshot[] {
  return forecast.map((m) => {
    const sub = m.activeWeeklySubscribers;
    const mrr = m.weeklySubRevenue;
    const revenuePerSub = sub > 0 ? m.totalRevenue / sub : 0;
    const aiCost = assumptions.baseHostingAiElevenLabsNZD * 0.4; // 40% of hosting+ai+eleven
    const hostingCost = assumptions.baseHostingAiElevenLabsNZD * 0.6;
    return {
      month: m.month,
      monthLabel: m.monthLabel,
      activeWeeklySubscribers: sub,
      newSubscribers: m.newSubscribers,
      lostSubscribers: m.lostSubscribers,
      churnPct: m.openingSubscribers > 0 ? (m.lostSubscribers / m.openingSubscribers) * 100 : 0,
      mrr,
      arr: mrr * 12,
      revenuePerSubscriber: revenuePerSub,
      dayPassSales: assumptions.dayPassSalesPerMonth,
      radioListeners: Math.round(sub * 3),
      telegramMembers: Math.round(sub * 1.5),
      socialViews: Math.round(sub * 200),
      contentToSubConversion: 2.5,
      aiCostPerSubscriber: sub > 0 ? aiCost / sub : 0,
      hostingCostPerSubscriber: sub > 0 ? hostingCost / sub : 0,
      contentSpendPerSubscriber: sub > 0 ? assumptions.contentCommunityNZD / sub : 0,
    };
  });
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

export function buildDashboardSummary(assumptions: Assumptions): DashboardSummary {
  const forecast = buildMonthlyForecast(assumptions);
  // Use the current month (month 1 as demo "current month")
  const current = forecast[0];
  const sub = current.activeWeeklySubscribers;

  return {
    activeWeeklySubscribers: sub,
    nextMilestone: getNextMilestone(sub),
    subscribersToGo: getNextMilestone(sub) !== null ? (getNextMilestone(sub) as number) - sub : null,
    mrr: current.weeklySubRevenue,
    arr: current.weeklySubRevenue * 12,
    monthlyRevenue: current.totalRevenue,
    monthlyOperatingProfit: current.operatingProfit,
    cashPosition: current.closingCash,
    currentSalaryTier: getSalaryTier(sub),
    nextSalaryTier: getNextSalaryTier(sub),
    monthlyForecast: forecast,
  };
}

export interface ForecastTargetMetric {
  actual: number;
  target: number;
  pctOfTarget: number;
  delta: number;
  achieved: boolean;
  inverse?: boolean;
}

export interface ForecastTargets {
  subscribers: ForecastTargetMetric;
  growthRate: ForecastTargetMetric;
  mrr: ForecastTargetMetric;
  arr: ForecastTargetMetric;
  revenuePerSubscriber: ForecastTargetMetric;
  monthsTo10k: ForecastTargetMetric;
  nextMilestone: number | null;
  subscribersToNextMilestone: number | null;
  currentSalaryTierLabel: string;
}

function buildTargetMetric(actual: number, target: number, inverse = false): ForecastTargetMetric {
  const pctRaw = inverse
    ? actual > 0
      ? (target / actual) * 100
      : 0
    : target > 0
      ? (actual / target) * 100
      : 0;

  return {
    actual,
    target,
    pctOfTarget: Math.max(0, pctRaw),
    delta: actual - target,
    achieved: inverse ? actual <= target : actual >= target,
    inverse,
  };
}

export function buildForecastTargets(assumptions: Assumptions, currentSubs: number): ForecastTargets {
  const forecast = buildMonthlyForecast(assumptions);
  const monthlyGrowthValues = forecast.slice(1).map((m) => m.growthPct);
  const avgGrowthPct =
    monthlyGrowthValues.length > 0
      ? monthlyGrowthValues.reduce((sum, value) => sum + value, 0) / monthlyGrowthValues.length
      : 0;

  const mrrActual = calcWeeklySubRevenue(currentSubs, assumptions.weeklyPassPriceNZD);
  const mrrTarget = calcWeeklySubRevenue(FORECAST_TARGET_SUBSCRIBERS, assumptions.weeklyPassPriceNZD);
  const arrActual = mrrActual * 12;
  const arrTarget = mrrTarget * 12;
  const revenuePerSubscriberActual = currentSubs > 0 ? mrrActual / currentSubs : 0;
  const revenuePerSubscriberTarget = mrrTarget / FORECAST_TARGET_SUBSCRIBERS;
  const monthTo10k =
    forecast.find((month) => month.activeWeeklySubscribers >= FORECAST_TARGET_SUBSCRIBERS)?.month ?? 13;
  const nextMilestone = getNextMilestone(currentSubs);

  return {
    subscribers: buildTargetMetric(currentSubs, FORECAST_TARGET_SUBSCRIBERS),
    growthRate: buildTargetMetric(avgGrowthPct, FORECAST_TARGET_GROWTH_PCT),
    mrr: buildTargetMetric(mrrActual, mrrTarget),
    arr: buildTargetMetric(arrActual, arrTarget),
    revenuePerSubscriber: buildTargetMetric(revenuePerSubscriberActual, revenuePerSubscriberTarget),
    monthsTo10k: buildTargetMetric(monthTo10k, FORECAST_TARGET_MONTHS_TO_10K, true),
    nextMilestone,
    subscribersToNextMilestone: nextMilestone !== null ? nextMilestone - currentSubs : null,
    currentSalaryTierLabel: getSalaryTier(currentSubs).label,
  };
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

export function fmtNZD(value: number): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat('en-NZ').format(Math.round(value));
}

export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Quarterly Aggregation ───────────────────────────────────────────────────

export function quarterlySum(values: number[]): number[] {
  return [
    values.slice(0, 3).reduce((a, b) => a + b, 0),
    values.slice(3, 6).reduce((a, b) => a + b, 0),
    values.slice(6, 9).reduce((a, b) => a + b, 0),
    values.slice(9, 12).reduce((a, b) => a + b, 0),
  ];
}
