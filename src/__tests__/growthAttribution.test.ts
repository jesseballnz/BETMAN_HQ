import { attributeUserOutcomes } from '@/lib/growth/attribution';
import type { CampaignPerformance } from '@/lib/growth/types';

function campaign(id: string): CampaignPerformance {
  return {
    campaignId: id,
    campaign: id,
    currency: 'NZD',
    spend: 20,
    impressions: 100,
    clicks: 10,
    landingPageViews: 8,
    signups: 0,
    trials: 0,
    paid: 0,
  };
}

describe('growth attribution', () => {
  const window = { since: '2026-09-15', until: '2026-09-21' };

  test('credits only exact Meta campaign IDs and reports coverage', () => {
    const result = attributeUserOutcomes([campaign('meta-1')], [
      { email: 'paid@example.com', createdAt: '2026-09-16T00:00:00Z', trialStartedAt: '2026-09-16T01:00:00Z', campaign: 'meta-1', planType: 'single' },
      { email: 'unknown@example.com', createdAt: '2026-09-17T00:00:00Z', campaign: 'friendly-name', planType: 'single' },
      { email: 'none@example.com', createdAt: '2026-09-18T00:00:00Z', trialStartedAt: '2026-09-18T01:00:00Z', campaign: 'unassigned', planType: 'single' },
    ], window, new Set(['paid@example.com']));

    expect(result.campaigns[0]).toMatchObject({ signups: 1, trials: 1, paid: 1 });
    expect(result.unattributed).toEqual({ commercialSignups: 2, trials: 1, paid: 0 });
    expect(result.coverage).toMatchObject({
      commercialSignups: 3,
      campaignAssignedSignups: 2,
      metaMatchedSignups: 1,
      trials: 2,
      metaMatchedTrials: 1,
      paid: 1,
      metaMatchedPaid: 1,
      signupAssignmentPct: 66.67,
      signupMatchPct: 33.33,
      trialMatchPct: 50,
      paidMatchPct: 100,
    });
  });

  test('excludes testers and users outside the reporting window', () => {
    const result = attributeUserOutcomes([campaign('meta-1')], [
      { email: 'tester@example.com', createdAt: '2026-09-16T00:00:00Z', campaign: 'meta-1', planType: 'tester' },
      { email: 'old@example.com', createdAt: '2026-09-14T23:59:59Z', campaign: 'meta-1', planType: 'single' },
    ], window, new Set(['tester@example.com', 'old@example.com']));

    expect(result.coverage.commercialSignups).toBe(0);
    expect(result.campaigns[0]).toMatchObject({ signups: 0, trials: 0, paid: 0 });
  });
});
