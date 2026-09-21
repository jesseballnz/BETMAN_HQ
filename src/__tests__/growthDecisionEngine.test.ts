import {
  aggregateFunnel,
  decideCampaign,
  DEFAULT_GROWTH_GUARDRAILS,
} from '@/lib/growth/decisionEngine';
import type { CampaignPerformance } from '@/lib/growth/types';

function campaign(overrides: Partial<CampaignPerformance> = {}): CampaignPerformance {
  return {
    campaignId: 'campaign-1',
    campaign: 'Winner',
    currency: 'NZD',
    spend: 10,
    impressions: 1000,
    clicks: 50,
    landingPageViews: 40,
    signups: 0,
    trials: 0,
    paid: 0,
    ...overrides,
  };
}

describe('growth decision engine', () => {
  test('pauses meaningful spend with no landings', () => {
    const decision = decideCampaign(campaign({ spend: 25, landingPageViews: 0 }));
    expect(decision.action).toBe('pause');
    expect(decision.budgetChangePct).toBe(-100);
  });

  test('does not scale traffic without trials', () => {
    const decision = decideCampaign(campaign({ spend: 5, landingPageViews: 100 }));
    expect(decision.action).toBe('hold');
    expect(decision.reason).toContain('no attributed trials');
  });

  test('scales only when trial evidence and cost pass the gate', () => {
    const decision = decideCampaign(campaign({ spend: 40, landingPageViews: 200, trials: 10 }));
    expect(decision.action).toBe('scale');
    expect(decision.budgetChangePct).toBe(DEFAULT_GROWTH_GUARDRAILS.maximumBudgetChangePct);
  });

  test('scales only when paid evidence and CAC pass the gate', () => {
    const decision = decideCampaign(campaign({ spend: 30, landingPageViews: 100, paid: 3 }));
    expect(decision.action).toBe('scale');
  });

  test('keeps unattributed outcomes visible without crediting campaigns', () => {
    const funnel = aggregateFunnel([campaign({ signups: 1, trials: 1 })], {
      commercialSignups: 2,
      trials: 1,
      paid: 1,
    });
    expect(funnel.commercialSignups).toBe(3);
    expect(funnel.unattributedSignups).toBe(2);
    expect(funnel.trials).toBe(2);
  });
});
