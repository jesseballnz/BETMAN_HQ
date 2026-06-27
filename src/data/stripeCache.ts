import { StripeSubscriberCounts } from '@/lib/stripe';

// Server-side in-memory cache for Stripe subscriber counts.
// Invalidated by the webhook handler on subscription events.
// TTL-based fallback: data older than CACHE_TTL_MS is re-fetched automatically.

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface CacheEntry {
  data: StripeSubscriberCounts;
  cachedAt: number;
}

let cache: CacheEntry | null = null;

export function getStripeCache(): StripeSubscriberCounts | null {
  if (!cache) return null;
  const age = Date.now() - cache.cachedAt;
  if (age > CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

export function setStripeCache(data: StripeSubscriberCounts): void {
  cache = { data, cachedAt: Date.now() };
}

/** Pass null to invalidate (e.g. from webhook) */
export function updateStripeCache(data: StripeSubscriberCounts | null): void {
  cache = data ? { data, cachedAt: Date.now() } : null;
}
