import { classifyPrice } from '@/lib/stripe';
import type Stripe from 'stripe';

// Helper to build minimal Stripe Price objects for testing
function makePrice(overrides: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: 'price_test',
    object: 'price',
    active: true,
    currency: 'nzd',
    metadata: {},
    product: 'prod_test',
    recurring: null,
    type: 'one_time',
    unit_amount: 995,
    billing_scheme: 'per_unit',
    created: 0,
    livemode: false,
    lookup_key: null,
    nickname: null,
    tax_behavior: null,
    tiers_mode: null,
    transform_quantity: null,
    unit_amount_decimal: '995',
    custom_unit_amount: null,
    ...overrides,
  } as unknown as Stripe.Price;
}

function makeProduct(overrides: Partial<Stripe.Product> = {}): Stripe.Product {
  return {
    id: 'prod_test',
    object: 'product',
    active: true,
    name: 'BETMAN Plan',
    metadata: {},
    ...overrides,
  } as unknown as Stripe.Product;
}

// ─── Plan classification by recurring interval ────────────────────────────────

describe('classifyPrice — by recurring interval', () => {
  test('week interval → weekly', () => {
    const price = makePrice({ recurring: { interval: 'week', interval_count: 1 } as Stripe.Price.Recurring });
    expect(classifyPrice(price, null)).toBe('weekly');
  });

  test('day interval → day_pass', () => {
    const price = makePrice({ recurring: { interval: 'day', interval_count: 1 } as Stripe.Price.Recurring });
    expect(classifyPrice(price, null)).toBe('day_pass');
  });

  test('month interval → other (not explicitly mapped)', () => {
    const price = makePrice({ recurring: { interval: 'month', interval_count: 1 } as Stripe.Price.Recurring });
    expect(classifyPrice(price, null)).toBe('other');
  });

  test('no recurring → other', () => {
    const price = makePrice({ recurring: null });
    expect(classifyPrice(price, null)).toBe('other');
  });
});

// ─── Plan classification by price metadata ────────────────────────────────────

describe('classifyPrice — by price metadata', () => {
  test('price metadata betman_plan=weekly → weekly', () => {
    const price = makePrice({ metadata: { betman_plan: 'weekly' } });
    expect(classifyPrice(price, null)).toBe('weekly');
  });

  test('price metadata betman_plan=day_pass → day_pass', () => {
    const price = makePrice({ metadata: { betman_plan: 'day_pass' } });
    expect(classifyPrice(price, null)).toBe('day_pass');
  });

  test('price metadata betman_plan=day pass (with space) → day_pass', () => {
    const price = makePrice({ metadata: { betman_plan: 'day pass' } });
    expect(classifyPrice(price, null)).toBe('day_pass');
  });
});

// ─── Plan classification by product metadata / name ───────────────────────────

describe('classifyPrice — by product', () => {
  test('product metadata betman_plan=weekly → weekly', () => {
    const price = makePrice();
    const product = makeProduct({ metadata: { betman_plan: 'weekly' } });
    expect(classifyPrice(price, product)).toBe('weekly');
  });

  test('product metadata betman_plan=day_pass → day_pass', () => {
    const price = makePrice();
    const product = makeProduct({ metadata: { betman_plan: 'day_pass' } });
    expect(classifyPrice(price, product)).toBe('day_pass');
  });

  test('product name containing "weekly" → weekly', () => {
    const price = makePrice();
    const product = makeProduct({ name: 'BETMAN Weekly Access' });
    expect(classifyPrice(price, product)).toBe('weekly');
  });

  test('product name containing "day pass" → day_pass', () => {
    const price = makePrice();
    const product = makeProduct({ name: 'BETMAN Day Pass' });
    expect(classifyPrice(price, product)).toBe('day_pass');
  });

  test('product name containing "day-pass" → day_pass', () => {
    const price = makePrice();
    const product = makeProduct({ name: 'BETMAN Day-Pass' });
    expect(classifyPrice(price, product)).toBe('day_pass');
  });

  test('unrecognised product name → other', () => {
    const price = makePrice();
    const product = makeProduct({ name: 'Unknown Plan' });
    expect(classifyPrice(price, product)).toBe('other');
  });
});

// ─── Explicit env var mapping takes priority ──────────────────────────────────

describe('classifyPrice — env var priority', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('STRIPE_WEEKLY_PRICE_ID match overrides interval', () => {
    process.env.STRIPE_WEEKLY_PRICE_ID = 'price_weekly_explicit';
    // Even though this price has a day interval, env var wins
    const price = makePrice({
      id: 'price_weekly_explicit',
      recurring: { interval: 'day', interval_count: 1 } as Stripe.Price.Recurring,
    });
    expect(classifyPrice(price, null)).toBe('weekly');
  });

  test('STRIPE_DAY_PASS_PRICE_ID match overrides interval', () => {
    process.env.STRIPE_DAY_PASS_PRICE_ID = 'price_day_explicit';
    const price = makePrice({
      id: 'price_day_explicit',
      recurring: { interval: 'week', interval_count: 1 } as Stripe.Price.Recurring,
    });
    expect(classifyPrice(price, null)).toBe('day_pass');
  });

  test('non-matching price ID falls through to interval classification', () => {
    process.env.STRIPE_WEEKLY_PRICE_ID = 'price_weekly_explicit';
    const price = makePrice({
      id: 'price_other',
      recurring: { interval: 'week', interval_count: 1 } as Stripe.Price.Recurring,
    });
    expect(classifyPrice(price, null)).toBe('weekly');
  });
});
