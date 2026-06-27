import { NextResponse } from 'next/server';
import { fetchStripeSubscriberCounts } from '@/lib/stripe';
import { getStripeCache, setStripeCache } from '@/data/stripeCache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Serve from cache if still fresh
    const cached = getStripeCache();
    if (cached) {
      return NextResponse.json({ ...cached, fromCache: true });
    }

    const counts = await fetchStripeSubscriberCounts();
    if (counts.isLive) {
      setStripeCache(counts);
    }
    return NextResponse.json({ ...counts, fromCache: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch Stripe subscriber counts: ${message}` },
      { status: 500 },
    );
  }
}
