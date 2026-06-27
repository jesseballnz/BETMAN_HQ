import {
  getSalaryTier,
  getNextSalaryTier,
  getNextMilestone,
  calcWeeklySubRevenue,
  calcDayPassRevenue,
  calcMonthlyRevenue,
  calcFounderSalariesTotal,
  calcTotalExpenses,
  buildMonthlyForecast,
  buildCashFlow,
  quarterlySum,
} from '@/lib/calculations';
import { DEFAULT_ASSUMPTIONS } from '@/lib/types';

// ─── Salary Tier Tests ────────────────────────────────────────────────────────

describe('getSalaryTier', () => {
  test('returns $0 tier for 0 subscribers', () => {
    const tier = getSalaryTier(0);
    expect(tier.monthlyPerFounder).toBe(0);
    expect(tier.minSubscribers).toBe(0);
  });

  test('returns $0 tier for 499 subscribers', () => {
    const tier = getSalaryTier(499);
    expect(tier.monthlyPerFounder).toBe(0);
  });

  test('returns $1,000 tier for 500 subscribers', () => {
    const tier = getSalaryTier(500);
    expect(tier.monthlyPerFounder).toBe(1000);
  });

  test('returns $1,000 tier for 999 subscribers', () => {
    const tier = getSalaryTier(999);
    expect(tier.monthlyPerFounder).toBe(1000);
  });

  test('returns $2,000 tier for 1,000 subscribers', () => {
    const tier = getSalaryTier(1000);
    expect(tier.monthlyPerFounder).toBe(2000);
  });

  test('returns $3,500 tier for 2,000 subscribers', () => {
    const tier = getSalaryTier(2000);
    expect(tier.monthlyPerFounder).toBe(3500);
  });

  test('returns $5,000 tier for 3,000 subscribers', () => {
    const tier = getSalaryTier(3000);
    expect(tier.monthlyPerFounder).toBe(5000);
  });

  test('returns $6,500 tier for 5,000 subscribers', () => {
    const tier = getSalaryTier(5000);
    expect(tier.monthlyPerFounder).toBe(6500);
  });

  test('returns $8,000 tier for 7,500 subscribers', () => {
    const tier = getSalaryTier(7500);
    expect(tier.monthlyPerFounder).toBe(8000);
  });

  test('returns Board Review tier for 10,000+ subscribers', () => {
    const tier = getSalaryTier(10000);
    expect(tier.monthlyPerFounder).toBe(-1);
    expect(tier.label).toContain('Board Review');
  });

  test('returns Board Review tier for 15,000 subscribers', () => {
    const tier = getSalaryTier(15000);
    expect(tier.monthlyPerFounder).toBe(-1);
  });

  test('returns correct tier for edge case: 4,999 subscribers', () => {
    const tier = getSalaryTier(4999);
    expect(tier.monthlyPerFounder).toBe(5000);
  });

  test('returns correct tier for edge case: 7,499 subscribers', () => {
    const tier = getSalaryTier(7499);
    expect(tier.monthlyPerFounder).toBe(6500);
  });
});

describe('getNextSalaryTier', () => {
  test('returns next tier for 0 subscribers', () => {
    const next = getNextSalaryTier(0);
    expect(next?.monthlyPerFounder).toBe(1000);
  });

  test('returns next tier from $1,000 tier', () => {
    const next = getNextSalaryTier(500);
    expect(next?.monthlyPerFounder).toBe(2000);
  });

  test('returns null when at max tier', () => {
    const next = getNextSalaryTier(10000);
    expect(next).toBeNull();
  });
});

describe('getNextMilestone', () => {
  test('returns 500 for 0 subscribers', () => {
    expect(getNextMilestone(0)).toBe(500);
  });

  test('returns 500 for 74 subscribers', () => {
    expect(getNextMilestone(74)).toBe(500);
  });

  test('returns 1,000 for 500 subscribers', () => {
    expect(getNextMilestone(500)).toBe(1000);
  });

  test('returns 10,000 for 9,999 subscribers', () => {
    expect(getNextMilestone(9999)).toBe(10000);
  });

  test('returns null for 10,000+ subscribers', () => {
    expect(getNextMilestone(10000)).toBeNull();
    expect(getNextMilestone(15000)).toBeNull();
  });
});

// ─── Revenue Calculation Tests ────────────────────────────────────────────────

describe('calcWeeklySubRevenue', () => {
  test('calculates revenue correctly for 100 subscribers at $9.95', () => {
    const revenue = calcWeeklySubRevenue(100, 9.95);
    // 100 * 9.95 * 4.33 = 4308.35 → rounds to 4308
    expect(revenue).toBe(4308);
  });

  test('returns 0 for 0 subscribers', () => {
    expect(calcWeeklySubRevenue(0, 9.95)).toBe(0);
  });

  test('scales approximately linearly with subscribers', () => {
    const rev1 = calcWeeklySubRevenue(100, 9.95);
    const rev2 = calcWeeklySubRevenue(200, 9.95);
    // Allow ±1 NZD rounding difference due to Math.round
    expect(Math.abs(rev2 - rev1 * 2)).toBeLessThanOrEqual(1);
  });
});

describe('calcDayPassRevenue', () => {
  test('calculates day pass revenue correctly', () => {
    // 50 passes at $7.95 = $397.50 → rounds to 398
    const revenue = calcDayPassRevenue(50, 7.95);
    expect(revenue).toBe(398);
  });

  test('returns 0 for 0 passes', () => {
    expect(calcDayPassRevenue(0, 7.95)).toBe(0);
  });
});

describe('calcMonthlyRevenue', () => {
  test('calculates total monthly revenue correctly', () => {
    const subs = 75;
    const revenue = calcMonthlyRevenue(subs, DEFAULT_ASSUMPTIONS);
    const expected =
      calcWeeklySubRevenue(subs, DEFAULT_ASSUMPTIONS.weeklyPassPriceNZD) +
      calcDayPassRevenue(DEFAULT_ASSUMPTIONS.dayPassSalesPerMonth, DEFAULT_ASSUMPTIONS.dayPassPriceNZD) +
      DEFAULT_ASSUMPTIONS.radioAdRevenue +
      DEFAULT_ASSUMPTIONS.sponsorshipRevenue;
    expect(revenue).toBe(expected);
  });

  test('includes all four revenue streams', () => {
    const revenue = calcMonthlyRevenue(100, DEFAULT_ASSUMPTIONS);
    expect(revenue).toBeGreaterThan(
      calcWeeklySubRevenue(100, DEFAULT_ASSUMPTIONS.weeklyPassPriceNZD)
    );
  });
});

// ─── P&L Total Calculation Tests ──────────────────────────────────────────────

describe('calcFounderSalariesTotal', () => {
  test('returns $0 for under 500 subscribers (3 founders × $0)', () => {
    expect(calcFounderSalariesTotal(0)).toBe(0);
    expect(calcFounderSalariesTotal(499)).toBe(0);
  });

  test('returns $3,000 for 500 subscribers (3 × $1,000)', () => {
    expect(calcFounderSalariesTotal(500)).toBe(3000);
  });

  test('returns $6,000 for 1,000 subscribers (3 × $2,000)', () => {
    expect(calcFounderSalariesTotal(1000)).toBe(6000);
  });

  test('returns $10,500 for 2,000 subscribers (3 × $3,500)', () => {
    expect(calcFounderSalariesTotal(2000)).toBe(10500);
  });

  test('returns $15,000 for 3,000 subscribers (3 × $5,000)', () => {
    expect(calcFounderSalariesTotal(3000)).toBe(15000);
  });
});

describe('calcTotalExpenses', () => {
  test('includes all expense categories', () => {
    const total = calcTotalExpenses(0, DEFAULT_ASSUMPTIONS);
    const expected =
      DEFAULT_ASSUMPTIONS.baseHostingAiElevenLabsNZD +
      DEFAULT_ASSUMPTIONS.contentCommunityNZD +
      DEFAULT_ASSUMPTIONS.administrationNZD +
      DEFAULT_ASSUMPTIONS.softwareNZD +
      DEFAULT_ASSUMPTIONS.insuranceNZD +
      DEFAULT_ASSUMPTIONS.professionalFeesNZD +
      calcFounderSalariesTotal(0);
    expect(total).toBe(expected);
  });

  test('increases expenses when salary tier unlocks', () => {
    const expensesAt0 = calcTotalExpenses(0, DEFAULT_ASSUMPTIONS);
    const expensesAt500 = calcTotalExpenses(500, DEFAULT_ASSUMPTIONS);
    // At 500 subs, founder salaries = 3 × $1,000 = $3,000 more
    expect(expensesAt500 - expensesAt0).toBe(3000);
  });
});

// ─── P&L Total Verification ───────────────────────────────────────────────────

describe('buildMonthlyForecast P&L totals', () => {
  const forecast = buildMonthlyForecast(DEFAULT_ASSUMPTIONS);

  test('generates 12 months of forecast', () => {
    expect(forecast).toHaveLength(12);
  });

  test('operating profit = total revenue - total expenses', () => {
    for (const month of forecast) {
      expect(month.operatingProfit).toBe(month.totalRevenue - month.totalExpenses);
    }
  });

  test('EBITDA equals operating profit (no D&A)', () => {
    for (const month of forecast) {
      expect(month.ebitda).toBe(month.operatingProfit);
    }
  });

  test('month 1 active subscribers match assumption', () => {
    expect(forecast[0].activeWeeklySubscribers).toBe(DEFAULT_ASSUMPTIONS.month1Subscribers);
  });

  test('month 2 active subscribers match assumption', () => {
    expect(forecast[1].activeWeeklySubscribers).toBe(DEFAULT_ASSUMPTIONS.month2Subscribers);
  });

  test('month 3 active subscribers match assumption', () => {
    expect(forecast[2].activeWeeklySubscribers).toBe(DEFAULT_ASSUMPTIONS.month3Subscribers);
  });

  test('month 12 active subscribers match assumption', () => {
    expect(forecast[11].activeWeeklySubscribers).toBe(DEFAULT_ASSUMPTIONS.month12Subscribers);
  });

  test('salary tier is calculated from subscriber count', () => {
    const month1 = forecast[0]; // 75 subs → $0
    expect(month1.currentSalaryPerFounder).toBe(0);
    expect(month1.salaryTierLabel).toBe('0–499 subscribers');

    const month2 = forecast[1]; // 300 subs → $0
    expect(month2.currentSalaryPerFounder).toBe(0);

    const month3 = forecast[2]; // 1000 subs → $2,000
    expect(month3.currentSalaryPerFounder).toBe(2000);
  });
});

// ─── Cash Flow Calculation Tests ─────────────────────────────────────────────

describe('buildCashFlow', () => {
  const forecast = buildMonthlyForecast(DEFAULT_ASSUMPTIONS);
  const cashFlow = buildCashFlow(forecast);

  test('generates 12 months of cash flow', () => {
    expect(cashFlow).toHaveLength(12);
  });

  test('operating cash flow = revenue - expenses', () => {
    for (const row of cashFlow) {
      expect(row.operatingCashFlow).toBe(row.revenueReceived - row.expensesPaid);
    }
  });

  test('closing cash = opening + operating cash flow + TENT funding', () => {
    for (const row of cashFlow) {
      expect(row.closingCash).toBe(
        row.openingCash + row.operatingCashFlow + row.tentFunding
      );
    }
  });

  test('opening cash of month N+1 = closing cash of month N', () => {
    for (let i = 0; i < cashFlow.length - 1; i++) {
      expect(cashFlow[i + 1].openingCash).toBe(cashFlow[i].closingCash);
    }
  });

  test('first month opening cash matches assumption', () => {
    expect(cashFlow[0].openingCash).toBe(DEFAULT_ASSUMPTIONS.openingCashNZD);
  });

  test('TENT funding is only triggered when operating cash flow is negative', () => {
    for (const row of cashFlow) {
      if (row.operatingCashFlow >= 0) {
        expect(row.tentFunding).toBe(0);
      } else {
        expect(row.tentFunding).toBe(Math.abs(row.operatingCashFlow));
      }
    }
  });
});

// ─── Quarterly Aggregation ────────────────────────────────────────────────────

describe('quarterlySum', () => {
  test('aggregates 12 values into 4 quarters', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const quarters = quarterlySum(values);
    expect(quarters).toHaveLength(4);
    expect(quarters[0]).toBe(6);   // 1+2+3
    expect(quarters[1]).toBe(15);  // 4+5+6
    expect(quarters[2]).toBe(24);  // 7+8+9
    expect(quarters[3]).toBe(33);  // 10+11+12
  });

  test('quarterly totals sum to annual total', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
    const quarters = quarterlySum(values);
    const annualFromQ = quarters.reduce((a, b) => a + b, 0);
    const annualDirect = values.reduce((a, b) => a + b, 0);
    expect(annualFromQ).toBe(annualDirect);
  });
});
