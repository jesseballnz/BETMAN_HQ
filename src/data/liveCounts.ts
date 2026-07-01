/**
 * getLiveSubscriberCounts
 *
 * Returns the current active subscriber counts from Stripe (if configured)
 * or falls back to the Assumptions-driven seed numbers.
 *
 * This is the single source of truth for "current subscribers" used by
 * all server pages.  The forecast for future months still uses Assumptions.
 */

import { fetchStripeSubscriberCounts, StripeSubscriberCounts } from '@/lib/stripe';
import { fetchCoreAuthSummary } from '@/lib/betmanCore';
import { getStripeCache, setStripeCache } from '@/data/stripeCache';
import { getAssumptions } from './store';

export interface LiveCounts {
  activeWeeklySubscribers: number;
  activeDayPassSalesPerMonth: number;
  payingCustomers: number;
  totalProvisionings: number;
  uniqueAccounts: number;
  activeAccounts: number;
  passwordPendingAccounts: number;
  isLive: boolean;
  fetchedAt: string;
  source: 'stripe' | 'assumptions';
  accountSource: 'core' | 'unavailable';
}

export async function getLiveSubscriberCounts(): Promise<LiveCounts> {
  const accountSummary = await fetchCoreAuthSummary().catch(() => null);

  // 1. Try cache first
  const cached = getStripeCache();
  if (cached) {
    return stripeCountsToLive(cached, accountSummary);
  }

  // 2. Try Stripe
  try {
    const counts = await fetchStripeSubscriberCounts();
    if (counts.isLive) {
      setStripeCache(counts);
      return stripeCountsToLive(counts, accountSummary);
    }
  } catch {
    // Fall through to assumptions
  }

  // 3. Fall back to current month Assumptions
  const assumptions = await getAssumptions();
  return {
    activeWeeklySubscribers: assumptions.month1Subscribers,
    activeDayPassSalesPerMonth: assumptions.dayPassSalesPerMonth,
    payingCustomers: assumptions.month1Subscribers,
    totalProvisionings: assumptions.month1Subscribers,
    uniqueAccounts: accountSummary?.uniqueAccounts ?? 0,
    activeAccounts: accountSummary?.activeAccounts ?? 0,
    passwordPendingAccounts: accountSummary?.passwordPendingAccounts ?? 0,
    isLive: false,
    fetchedAt: new Date().toISOString(),
    source: 'assumptions',
    accountSource: accountSummary ? 'core' : 'unavailable',
  };
}

function stripeCountsToLive(
  counts: StripeSubscriberCounts,
  accountSummary: Awaited<ReturnType<typeof fetchCoreAuthSummary>> | null,
): LiveCounts {
  return {
    activeWeeklySubscribers: counts.activeWeeklySubscribers,
    // Day pass subscriptions in Stripe map to day-pass sales
    activeDayPassSalesPerMonth: counts.activeDayPassSubscribers + counts.recentDayPassCheckoutSessions,
    payingCustomers: counts.totalPayingCustomers,
    totalProvisionings: counts.totalProvisionings,
    uniqueAccounts: accountSummary?.uniqueAccounts ?? 0,
    activeAccounts: accountSummary?.activeAccounts ?? 0,
    passwordPendingAccounts: accountSummary?.passwordPendingAccounts ?? 0,
    isLive: counts.isLive,
    fetchedAt: counts.fetchedAt,
    source: 'stripe',
    accountSource: accountSummary ? 'core' : 'unavailable',
  };
}
