export type GrowthAction = 'pause' | 'reduce' | 'hold' | 'scale';

export interface CampaignPerformance {
  campaignId: string;
  campaign: string;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  signups: number;
  trials: number;
  paid: number;
}

export interface GrowthGuardrails {
  zeroLandingPauseSpend: number;
  minimumLandingSample: number;
  maximumCostPerLanding: number;
  maximumCostPerTrial: number;
  maximumPaidCac: number;
  minimumTrialsToScale: number;
  minimumPaidToScale: number;
  maximumBudgetChangePct: number;
}

export interface GrowthDecision {
  campaignId: string;
  campaign: string;
  action: GrowthAction;
  budgetChangePct: number;
  reason: string;
  evidence: {
    spend: number;
    landingPageViews: number;
    trials: number;
    paid: number;
    costPerLanding: number | null;
    costPerTrial: number | null;
    paidCac: number | null;
  };
}

export interface GrowthFunnel {
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  commercialSignups: number;
  trials: number;
  paid: number;
  unattributedSignups: number;
  unattributedTrials: number;
  unattributedPaid: number;
}

export interface GrowthSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  mode: 'dry-run' | 'execute';
  window: {
    since: string;
    until: string;
    timeZone: string;
  };
  health: {
    ok: boolean;
    failures: string[];
    sources: Record<string, string>;
  };
  funnel: GrowthFunnel;
  attribution?: {
    commercialSignups: number;
    campaignAssignedSignups: number;
    metaMatchedSignups: number;
    trials: number;
    metaMatchedTrials: number;
    paid: number;
    metaMatchedPaid: number;
    signupAssignmentPct: number;
    signupMatchPct: number;
    trialMatchPct: number;
    paidMatchPct: number;
  };
  campaigns: CampaignPerformance[];
  decisions: GrowthDecision[];
}
