import type { ProvisionedUser } from '@/lib/betmanCore';
import type { StripeSubscriberCounts } from '@/lib/stripe';

const NON_PAYING_PLANS = new Set(['tester', 'trial', 'free', 'complimentary', 'comp']);

function normalizedEmail(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function isCorePaidUser(user: ProvisionedUser): boolean {
  if (!user.subscriptionActive) return false;
  const plan = String(user.planType || '').trim().toLowerCase();
  const status = String(user.subscriptionStatus || '').trim().toLowerCase();
  if (NON_PAYING_PLANS.has(plan)) return false;
  if (['canceled', 'cancelled', 'inactive', 'expired', 'past_due', 'unpaid'].includes(status)) return false;
  return true;
}

export function buildPaidAccountSet(
  users: ProvisionedUser[],
  stripeCounts: StripeSubscriberCounts | null,
): Set<string> {
  const paidEmails = new Set((stripeCounts?.payingCustomerEmails || []).map(normalizedEmail).filter(Boolean));
  for (const user of users) {
    if (isCorePaidUser(user)) {
      const email = normalizedEmail(user.email);
      if (email) paidEmails.add(email);
    }
  }
  return paidEmails;
}

export function paidAccountCount(users: ProvisionedUser[], stripeCounts: StripeSubscriberCounts | null): number {
  const paidEmails = buildPaidAccountSet(users, stripeCounts);
  return Math.max(stripeCounts?.totalPayingCustomers ?? 0, paidEmails.size);
}
