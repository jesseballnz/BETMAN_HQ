import type { ConversionTrafficCampaign } from '@/lib/hqConversion';

export interface SourceSuccessRow {
  platform: string;
  landingSessions: number;
  signups: number;
  trials: number;
  verifiedTrials: number;
  conversions: number;
  campaigns: number;
  sharePct: number;
}

export interface SourceSuccessSummary {
  rows: SourceSuccessRow[];
  landingSessions: number;
  campaigns: number;
}

function emptyRow(platform: string): SourceSuccessRow {
  return {
    platform,
    landingSessions: 0,
    signups: 0,
    trials: 0,
    verifiedTrials: 0,
    conversions: 0,
    campaigns: 0,
    sharePct: 0,
  };
}

export function buildSourceSuccessSummary(campaigns: ConversionTrafficCampaign[]): SourceSuccessSummary {
  const byPlatform = new Map<string, SourceSuccessRow>();
  const totalLandings = campaigns.reduce((sum, row) => sum + row.landingSessions, 0);

  for (const campaign of campaigns) {
    const platform = campaign.platform || 'unattributed';
    const row = byPlatform.get(platform) ?? emptyRow(platform);
    row.landingSessions += campaign.landingSessions;
    row.signups += campaign.signups;
    row.trials += campaign.trials;
    row.verifiedTrials += campaign.verifiedTrials;
    row.conversions += campaign.conversions;
    row.campaigns += 1;
    byPlatform.set(platform, row);
  }

  const rows = Array.from(byPlatform.values())
    .map((row) => ({
      ...row,
      sharePct: totalLandings > 0 ? (row.landingSessions / totalLandings) * 100 : 0,
    }))
    .sort((a, b) => b.landingSessions - a.landingSessions);

  return {
    rows,
    landingSessions: totalLandings,
    campaigns: campaigns.length,
  };
}
