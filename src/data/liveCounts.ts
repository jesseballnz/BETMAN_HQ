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
import { getStripeCache, setStripeCache } from '@/data/stripeCache';
import { getAssumptions } from './store';

export interface LiveCounts {
  activeWeeklySubscribers: number;
  activeDayPassSalesPerMonth: number;
  isLive: boolean;
  fetchedAt: string;
  source: 'stripe' | 'assumptions';
}

export async function getLiveSubscriberCounts(): Promise<LiveCounts> {
  // 1. Try cache first
  const cached = getStripeCache();
  if (cached) {
    return stripeCountsToLive(cached);
  }

  // 2. Try Stripe
  try {
    const counts = await fetchStripeSubscriberCounts();
    if (counts.isLive) {
      setStripeCache(counts);
      return stripeCountsToLive(counts);
    }
  } catch {
    // Fall through to assumptions
  }

  // 3. Fall back to current month Assumptions
  const assumptions = getAssumptions();
  return {
    activeWeeklySubscribers: assumptions.month1Subscribers,
    activeDayPassSalesPerMonth: assumptions.dayPassSalesPerMonth,
    isLive: false,
    fetchedAt: new Date().toISOString(),
    source: 'assumptions',
  };
}

function stripeCountsToLive(counts: StripeSubscriberCounts): LiveCounts {
  return {
    activeWeeklySubscribers: counts.activeWeeklySubscribers,
    // Day pass subscriptions in Stripe map to day-pass sales
    activeDayPassSalesPerMonth: counts.activeDayPassSubscribers,
    isLive: counts.isLive,
    fetchedAt: counts.fetchedAt,
    source: 'stripe',
  };
}
