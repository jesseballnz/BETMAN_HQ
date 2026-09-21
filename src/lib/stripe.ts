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
const productCache = new Map<string, Stripe.Product>();

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

async function getPriceProduct(client: Stripe, price: Stripe.Price): Promise<Stripe.Product | null> {
  if (!price.product) return null;
  if (typeof price.product !== 'string') return price.product as Stripe.Product;

  const cached = productCache.get(price.product);
  if (cached) return cached;

  const product = await client.products.retrieve(price.product);
  productCache.set(price.product, product);
  return product;
}

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
  totalPayingCustomers: number;
  payingCustomersByOperatingMonth: Record<number, number>;
  recentWeeklyCheckoutSessions: number;
  recentDayPassCheckoutSessions: number;
  recentOtherCheckoutSessions: number;
  totalActiveSubscriptions: number;
  totalRecentCheckoutSessions: number;
  totalProvisionings: number;
  /** Normalized emails for matching Stripe-paid customers to Core profiles. Server-side only. */
  payingCustomerEmails: string[];
  /** Stable Stripe customer IDs for matching paid customers to Core profiles. Server-side only. */
  payingCustomerIds: string[];
  /** ISO timestamp of when this data was fetched */
  fetchedAt: string;
  /** true when STRIPE_SECRET_KEY is configured, false when using seed data */
  isLive: boolean;
}

interface CountedSubscription {
  customerKey: string;
  customerEmail: string;
  planType: BetmanPlanType;
  status: Stripe.Subscription.Status;
  created: number;
  canceledAt: number | null;
  endedAt: number | null;
  paidLatestInvoice: boolean;
  excludedFromPaid: boolean;
}

const NON_PAYING_PLAN_TERMS = ['tester', 'trial', 'free', 'complimentary', 'comp'];

export function isExcludedPaidPlan(price: Stripe.Price, product: Stripe.Product | null): boolean {
  const values = [
    price.nickname,
    price.metadata?.betman_plan,
    price.metadata?.plan_type,
    product?.name,
    product?.metadata?.betman_plan,
    product?.metadata?.plan_type,
  ].map((value) => String(value || '').trim().toLowerCase());
  return values.some((value) => NON_PAYING_PLAN_TERMS.some((term) => (
    value === term || value.startsWith(`${term} `) || value.startsWith(`${term}-`) || value.startsWith(`${term}_`)
  )));
}

function customerIdentity(customer: string | Stripe.Customer | Stripe.DeletedCustomer): { key: string; email: string } {
  if (typeof customer === 'string') return { key: customer, email: '' };
  const email = 'email' in customer ? String(customer.email || '').trim().toLowerCase() : '';
  return { key: customer.id || email, email };
}

function nzOperatingYearStart(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return month >= 6 ? year : year - 1;
}

function operatingMonthEndUnix(operatingMonth: number): number {
  const yearStart = nzOperatingYearStart();
  const calendarMonthIndex = (5 + operatingMonth) % 12;
  const calendarYear = yearStart + (operatingMonth >= 8 ? 1 : 0);
  return Date.UTC(calendarYear, calendarMonthIndex, 1) / 1000;
}

function subscriptionActiveAt(subscription: CountedSubscription, unixSeconds: number): boolean {
  return (
    subscription.created < unixSeconds &&
    (!subscription.canceledAt || subscription.canceledAt >= unixSeconds) &&
    (!subscription.endedAt || subscription.endedAt >= unixSeconds)
  );
}

function latestInvoicePaid(subscription: Stripe.Subscription): boolean {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return false;
  return invoice.status === 'paid' && Number(invoice.amount_paid || 0) > 0;
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
      totalPayingCustomers: 0,
      payingCustomersByOperatingMonth: {},
      recentWeeklyCheckoutSessions: 0,
      recentDayPassCheckoutSessions: 0,
      recentOtherCheckoutSessions: 0,
      totalActiveSubscriptions: 0,
      totalRecentCheckoutSessions: 0,
      totalProvisionings: 0,
      payingCustomerEmails: [],
      payingCustomerIds: [],
      fetchedAt,
      isLive: false,
    };
  }

  const subscriptions: CountedSubscription[] = [];

  // Fetch active subscriptions with price data expanded. Stripe rejects
  // data.items.data.price.product because it is beyond the expansion depth limit.
  const client = getStripeClient();
  for await (const subscription of client.subscriptions.list({
    status: 'all',
    expand: ['data.items.data.price', 'data.latest_invoice', 'data.customer'],
    limit: 100,
  })) {
    // A subscription can have multiple items (plan bundles), but in practice
    // BETMAN will have one item per subscription. We classify by the first item.
    const item = subscription.items.data[0];
    if (!item) continue;

    const price = item.price as Stripe.Price;
    const product = await getPriceProduct(client, price);
    const customer = customerIdentity(subscription.customer);

    subscriptions.push({
      customerKey: customer.key,
      customerEmail: customer.email,
      planType: classifyPrice(price, product),
      status: subscription.status,
      created: subscription.created,
      canceledAt: subscription.canceled_at,
      endedAt: subscription.ended_at,
      paidLatestInvoice: latestInvoicePaid(subscription),
      excludedFromPaid: isExcludedPaidPlan(price, product),
    });
  }

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
  const paidSubscriptions = activeSubscriptions.filter((subscription) => (
    subscription.paidLatestInvoice && !subscription.excludedFromPaid
  ));
  const paidCustomerKeys = new Set(paidSubscriptions.map((subscription) => subscription.customerKey));
  const paidWeeklyCustomerKeys = new Set(paidSubscriptions
    .filter((subscription) => subscription.planType === 'weekly')
    .map((subscription) => subscription.customerKey));
  const activeDayPassSubscriptions = activeSubscriptions.filter((subscription) => subscription.planType === 'day_pass');
  const activeOtherSubscriptions = activeSubscriptions.filter((subscription) => subscription.planType === 'other');
  const payingCustomersByOperatingMonth = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const monthEnd = operatingMonthEndUnix(month);
      const count = new Set(subscriptions.filter((subscription) => (
        subscription.planType === 'weekly' &&
        subscription.paidLatestInvoice &&
        !subscription.excludedFromPaid &&
        subscriptionActiveAt(subscription, monthEnd)
      )).map((subscription) => subscription.customerKey)).size;
      return [month, count];
    }),
  );

  return {
    activeWeeklySubscribers: paidWeeklyCustomerKeys.size,
    activeDayPassSubscribers: activeDayPassSubscriptions.length,
    activeOtherSubscribers: activeOtherSubscriptions.length,
    totalPayingCustomers: paidCustomerKeys.size,
    payingCustomersByOperatingMonth,
    recentWeeklyCheckoutSessions: 0,
    recentDayPassCheckoutSessions: 0,
    recentOtherCheckoutSessions: 0,
    totalActiveSubscriptions: activeSubscriptions.length,
    totalRecentCheckoutSessions: 0,
    totalProvisionings: activeSubscriptions.length,
    payingCustomerEmails: Array.from(new Set(paidSubscriptions
      .map((subscription) => subscription.customerEmail)
      .filter(Boolean))),
    payingCustomerIds: Array.from(paidCustomerKeys),
    fetchedAt,
    isLive: true,
  };
}
