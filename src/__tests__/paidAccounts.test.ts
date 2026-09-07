import { buildPaidAccountSet, isCorePaidUser, paidAccountCount } from '@/lib/paidAccounts';

describe('paid account helpers', () => {
  test('keeps Core-paid accounts visible when Stripe returns fewer emails', () => {
    const users = [
      { email: 'stripe@example.com', planType: 'weekly', subscriptionStatus: 'active', subscriptionActive: true },
      { email: 'core-only@example.com', planType: 'weekly', subscriptionStatus: 'active', subscriptionActive: true },
      { email: 'trial@example.com', planType: 'trial', subscriptionStatus: 'active', subscriptionActive: true },
    ];
    const stripeCounts = {
      totalPayingCustomers: 1,
      payingCustomerEmails: ['stripe@example.com'],
    };

    expect(buildPaidAccountSet(users, stripeCounts as never)).toEqual(new Set(['stripe@example.com', 'core-only@example.com']));
    expect(paidAccountCount(users, stripeCounts as never)).toBe(2);
  });

  test('does not downgrade Stripe totals when customer emails are unavailable', () => {
    const users = [
      { email: 'core@example.com', planType: 'weekly', subscriptionStatus: 'active', subscriptionActive: true },
    ];
    const stripeCounts = {
      totalPayingCustomers: 4,
      payingCustomerEmails: [],
    };

    expect(paidAccountCount(users, stripeCounts as never)).toBe(4);
  });

  test('excludes trial, free and inactive Core plans from paid fallback', () => {
    expect(isCorePaidUser({ email: 'a@example.com', planType: 'trial', subscriptionStatus: 'active', subscriptionActive: true })).toBe(false);
    expect(isCorePaidUser({ email: 'b@example.com', planType: 'free', subscriptionStatus: 'active', subscriptionActive: true })).toBe(false);
    expect(isCorePaidUser({ email: 'c@example.com', planType: 'weekly', subscriptionStatus: 'canceled', subscriptionActive: true })).toBe(false);
    expect(isCorePaidUser({ email: 'd@example.com', planType: 'weekly', subscriptionStatus: 'active', subscriptionActive: true })).toBe(true);
  });
});
