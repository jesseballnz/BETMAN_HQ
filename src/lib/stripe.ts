import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  // Warn at module load time during dev; throw at request time in production
  // so that `next build` can still complete without Stripe keys configured.
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[BETMAN HQ] STRIPE_SECRET_KEY is not set — running in demo mode');
  }
}

// Stripe is initialised lazily; if the key is missing, fetchStripeSubscriberCounts
// will return isLive:false rather than crashing at module load time.
let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    });
  }
  return _stripe;
}

// Export for direct use in webhook (where we need stripe.webhooks.constructEvent)
export function getStripe(): Stripe {
  return getStripeClient();
}

// Keep a named export for backwards compat with tests that mock stripe directly
export const stripe = {
  get webhooks() { return getStripeClient().webhooks; },
};

// ─── Plan type detection ──────────────────────────────────────────────────────
// BETMAN uses weekly subscriptions and day passes.
// Plans are identified by Stripe Price recurring interval or product metadata.
//
// Priority order for identifying plan type:
//   1. STRIPE_WEEKLY_PRICE_ID / STRIPE_DAY_PASS_PRICE_ID env vars (explicit mapping)
//   2. price.recurring.interval === 'week' → weekly
//   3. price.recurring.interval === 'day'  → day pass
//   4. price.metadata.betman_plan === 'weekly' | 'day_pass'
//   5. product.metadata.betman_plan === 'weekly' | 'day_pass'
//   6. product name contains 'weekly' | 'day pass' (case-insensitive)

export type BetmanPlanType = 'weekly' | 'day_pass' | 'other';

export function classifyPrice(
  price: Stripe.Price,
  product: Stripe.Product | null,
): BetmanPlanType {
  const weeklyPriceId = process.env.STRIPE_WEEKLY_PRICE_ID;
  const dayPassPriceId = process.env.STRIPE_DAY_PASS_PRICE_ID;

  // 1. Explicit env var mapping
  if (weeklyPriceId && price.id === weeklyPriceId) return 'weekly';
  if (dayPassPriceId && price.id === dayPassPriceId) return 'day_pass';

  // 2. Recurring interval
  if (price.recurring?.interval === 'week') return 'weekly';
  if (price.recurring?.interval === 'day') return 'day_pass';

  // 3. Price metadata
  const priceMeta = price.metadata?.betman_plan?.toLowerCase();
  if (priceMeta === 'weekly') return 'weekly';
  if (priceMeta === 'day_pass' || priceMeta === 'day pass') return 'day_pass';

  // 4. Product metadata / name
  if (product) {
    const productMeta = product.metadata?.betman_plan?.toLowerCase();
    if (productMeta === 'weekly') return 'weekly';
    if (productMeta === 'day_pass' || productMeta === 'day pass') return 'day_pass';

    const productName = product.name.toLowerCase();
    if (productName.includes('weekly')) return 'weekly';
    if (productName.includes('day pass') || productName.includes('day-pass')) return 'day_pass';
  }

  return 'other';
}

// ─── Subscriber counts ────────────────────────────────────────────────────────

export interface StripeSubscriberCounts {
  activeWeeklySubscribers: number;
  activeDayPassSubscribers: number;
  activeOtherSubscribers: number;
  totalActiveSubscriptions: number;
  /** ISO timestamp of when this data was fetched */
  fetchedAt: string;
  /** true when STRIPE_SECRET_KEY is configured, false when using seed data */
  isLive: boolean;
}

/**
 * Fetches all active Stripe subscriptions and returns subscriber counts
 * broken down by BETMAN plan type (weekly vs day pass).
 *
 * Uses auto-pagination to handle accounts with >100 subscriptions.
 */
export async function fetchStripeSubscriberCounts(): Promise<StripeSubscriberCounts> {
  const fetchedAt = new Date().toISOString();

  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      activeWeeklySubscribers: 0,
      activeDayPassSubscribers: 0,
      activeOtherSubscribers: 0,
      totalActiveSubscriptions: 0,
      fetchedAt,
      isLive: false,
    };
  }

  let weeklyCount = 0;
  let dayPassCount = 0;
  let otherCount = 0;

  // Fetch all active subscriptions with their price and product data expanded
  const client = getStripeClient();
  for await (const subscription of client.subscriptions.list({
    status: 'active',
    expand: ['data.items.data.price.product'],
    limit: 100,
  })) {
    // A subscription can have multiple items (plan bundles), but in practice
    // BETMAN will have one item per subscription. We classify by the first item.
    const item = subscription.items.data[0];
    if (!item) continue;

    const price = item.price as Stripe.Price;
    const product =
      typeof price.product === 'string' ? null : (price.product as Stripe.Product);

    const planType = classifyPrice(price, product);

    if (planType === 'weekly') weeklyCount++;
    else if (planType === 'day_pass') dayPassCount++;
    else otherCount++;
  }

  return {
    activeWeeklySubscribers: weeklyCount,
    activeDayPassSubscribers: dayPassCount,
    activeOtherSubscribers: otherCount,
    totalActiveSubscriptions: weeklyCount + dayPassCount + otherCount,
    fetchedAt,
    isLive: true,
  };
}
