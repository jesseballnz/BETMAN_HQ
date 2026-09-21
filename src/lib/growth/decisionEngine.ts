import type {
  CampaignPerformance,
  GrowthDecision,
  GrowthFunnel,
  GrowthGuardrails,
} from './types';

export const DEFAULT_GROWTH_GUARDRAILS: GrowthGuardrails = {
  zeroLandingPauseSpend: 20,
  minimumLandingSample: 25,
  maximumCostPerLanding: 0.6,
  maximumCostPerTrial: 5,
  maximumPaidCac: 15,
  minimumTrialsToScale: 10,
  minimumPaidToScale: 3,
  maximumBudgetChangePct: 20,
};

function unitCost(spend: number, outcomes: number): number | null {
  return outcomes > 0 ? spend / outcomes : null;
}

function evidence(row: CampaignPerformance): GrowthDecision['evidence'] {
  return {
    spend: row.spend,
    landingPageViews: row.landingPageViews,
    trials: row.trials,
    paid: row.paid,
    costPerLanding: unitCost(row.spend, row.landingPageViews),
    costPerTrial: unitCost(row.spend, row.trials),
    paidCac: unitCost(row.spend, row.paid),
  };
}

export function decideCampaign(
  row: CampaignPerformance,
  guardrails: GrowthGuardrails = DEFAULT_GROWTH_GUARDRAILS,
): GrowthDecision {
  const metrics = evidence(row);
  const base = { campaignId: row.campaignId, campaign: row.campaign, evidence: metrics };

  if (row.spend >= guardrails.zeroLandingPauseSpend && row.landingPageViews === 0) {
    return {
      ...base,
      action: 'pause',
      budgetChangePct: -100,
      reason: 'Meaningful spend produced zero landing-page views.',
    };
  }

  const enoughPaidEvidence = row.paid >= guardrails.minimumPaidToScale;
  const enoughTrialEvidence = row.trials >= guardrails.minimumTrialsToScale;
  const paidEfficient = metrics.paidCac !== null && metrics.paidCac <= guardrails.maximumPaidCac;
  const trialEfficient = metrics.costPerTrial !== null && metrics.costPerTrial <= guardrails.maximumCostPerTrial;
  if ((enoughPaidEvidence && paidEfficient) || (enoughTrialEvidence && trialEfficient)) {
    return {
      ...base,
      action: 'scale',
      budgetChangePct: guardrails.maximumBudgetChangePct,
      reason: enoughPaidEvidence
        ? 'Paid-conversion volume and CAC passed the scale gate.'
        : 'Trial volume and cost passed the scale gate.',
    };
  }

  if (row.landingPageViews >= guardrails.minimumLandingSample && row.trials === 0) {
    return {
      ...base,
      action: 'hold',
      budgetChangePct: 0,
      reason: 'Traffic exists but no attributed trials; repair attribution or activation before scaling.',
    };
  }

  if (
    row.landingPageViews >= guardrails.minimumLandingSample
    && metrics.costPerLanding !== null
    && metrics.costPerLanding > guardrails.maximumCostPerLanding
  ) {
    return {
      ...base,
      action: 'reduce',
      budgetChangePct: -guardrails.maximumBudgetChangePct,
      reason: 'Cost per landing-page view exceeded the configured ceiling.',
    };
  }

  return {
    ...base,
    action: 'hold',
    budgetChangePct: 0,
    reason: 'Insufficient downstream evidence for a budget change.',
  };
}

export function decidePortfolio(
  campaigns: CampaignPerformance[],
  guardrails: GrowthGuardrails = DEFAULT_GROWTH_GUARDRAILS,
): GrowthDecision[] {
  return campaigns.map((row) => decideCampaign(row, guardrails));
}

export function aggregateFunnel(
  campaigns: CampaignPerformance[],
  unattributed: Pick<GrowthFunnel, 'commercialSignups' | 'trials' | 'paid'>,
): GrowthFunnel {
  const attributed = campaigns.reduce((sum, row) => ({
    spend: sum.spend + row.spend,
    impressions: sum.impressions + row.impressions,
    clicks: sum.clicks + row.clicks,
    landingPageViews: sum.landingPageViews + row.landingPageViews,
    commercialSignups: sum.commercialSignups + row.signups,
    trials: sum.trials + row.trials,
    paid: sum.paid + row.paid,
  }), {
    spend: 0,
    impressions: 0,
    clicks: 0,
    landingPageViews: 0,
    commercialSignups: 0,
    trials: 0,
    paid: 0,
  });

  return {
    ...attributed,
    commercialSignups: attributed.commercialSignups + unattributed.commercialSignups,
    trials: attributed.trials + unattributed.trials,
    paid: attributed.paid + unattributed.paid,
    unattributedSignups: unattributed.commercialSignups,
    unattributedTrials: unattributed.trials,
    unattributedPaid: unattributed.paid,
  };
}
