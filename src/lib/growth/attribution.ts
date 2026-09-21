import type { CampaignPerformance } from './types';

export interface AttributableUser {
  email?: string;
  createdAt?: string;
  trialStartedAt?: string;
  campaign?: string;
  planType?: string;
}

export interface AttributionCoverage {
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
}

interface Window { since: string; until: string }

function startUtc(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}

export function attributeUserOutcomes(
  campaigns: CampaignPerformance[],
  users: AttributableUser[],
  window: Window,
  paidEmails: Set<string>,
) {
  const attributedCampaigns = campaigns.map((campaign) => ({ ...campaign }));
  const byCampaign = new Map(attributedCampaigns.map((campaign) => [campaign.campaignId, campaign]));
  const start = startUtc(window.since);
  const end = startUtc(window.until) + 24 * 60 * 60 * 1000;
  const unattributed = { commercialSignups: 0, trials: 0, paid: 0 };
  let campaignAssignedSignups = 0;
  let metaMatchedSignups = 0;
  let totalTrials = 0;
  let metaMatchedTrials = 0;
  let totalPaid = 0;
  let metaMatchedPaid = 0;

  for (const user of users) {
    const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    if (!created || created < start || created >= end) continue;
    if (String(user.planType || '').toLowerCase() === 'tester') continue;

    const campaignId = String(user.campaign || '').trim();
    const assigned = Boolean(campaignId && campaignId.toLowerCase() !== 'unassigned');
    const target = assigned ? byCampaign.get(campaignId) : undefined;
    const trial = Boolean(user.trialStartedAt);
    const paid = paidEmails.has(String(user.email || '').trim().toLowerCase());

    if (assigned) campaignAssignedSignups += 1;
    if (trial) totalTrials += 1;
    if (paid) totalPaid += 1;

    if (target) {
      target.signups += 1;
      metaMatchedSignups += 1;
      if (trial) {
        target.trials += 1;
        metaMatchedTrials += 1;
      }
      if (paid) {
        target.paid += 1;
        metaMatchedPaid += 1;
      }
    } else {
      unattributed.commercialSignups += 1;
      if (trial) unattributed.trials += 1;
      if (paid) unattributed.paid += 1;
    }
  }

  const coverage: AttributionCoverage = {
    commercialSignups: metaMatchedSignups + unattributed.commercialSignups,
    campaignAssignedSignups,
    metaMatchedSignups,
    trials: totalTrials,
    metaMatchedTrials,
    paid: totalPaid,
    metaMatchedPaid,
    signupAssignmentPct: percentage(campaignAssignedSignups, metaMatchedSignups + unattributed.commercialSignups),
    signupMatchPct: percentage(metaMatchedSignups, metaMatchedSignups + unattributed.commercialSignups),
    trialMatchPct: percentage(metaMatchedTrials, totalTrials),
    paidMatchPct: percentage(metaMatchedPaid, totalPaid),
  };

  return { campaigns: attributedCampaigns, unattributed, coverage };
}
