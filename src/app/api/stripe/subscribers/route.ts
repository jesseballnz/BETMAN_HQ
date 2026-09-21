import { NextResponse } from 'next/server';
import { fetchStripeSubscriberCounts } from '@/lib/stripe';
import { getStripeCache, setStripeCache } from '@/data/stripeCache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Serve from cache if still fresh
    const cached = getStripeCache();
    if (cached) {
      const publicCounts: Partial<typeof cached> = { ...cached };
      delete publicCounts.payingCustomerEmails;
      delete publicCounts.payingCustomerIds;
      return NextResponse.json({ ...publicCounts, fromCache: true });
    }

    const counts = await fetchStripeSubscriberCounts();
    if (counts.isLive) {
      setStripeCache(counts);
    }
    const publicCounts: Partial<typeof counts> = { ...counts };
    delete publicCounts.payingCustomerEmails;
    delete publicCounts.payingCustomerIds;
    return NextResponse.json({ ...publicCounts, fromCache: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch Stripe subscriber counts: ${message}` },
      { status: 500 },
    );
  }
}
