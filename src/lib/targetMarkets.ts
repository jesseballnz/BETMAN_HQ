import { APAC_MARKET_CENTRES } from '@/lib/geoProjection';
import type { ProvisionedUser } from '@/lib/betmanCore';
import type { ConversionTrafficCity, ConversionTrafficGeography } from '@/lib/hqConversion';
import type { MetaMarketMetric } from '@/lib/metaAds';

const UNKNOWN_COUNTRY = 'UNATTRIBUTED';
const UNKNOWN_TARGET_MARKET = {
  code: UNKNOWN_COUNTRY,
  name: 'Unattributed',
  short: 'UNK',
  colour: '#94a3b8',
} as const;

export interface TargetMarketRow {
  code: string;
  name: string;
  short: string;
  colour: string;
  currency: string;
  metaLandingPageViews: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ownedSessions: number;
  trialCount: number;
  customerCount: number;
  areas: number;
  sharePct: number;
}

function countryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (['AUS', 'AUSTRALIA'].includes(normalized)) return 'AU';
  if (['NZL', 'NEW ZEALAND', 'AOTEAROA'].includes(normalized)) return 'NZ';
  if (['HKG', 'HONG KONG'].includes(normalized)) return 'HK';
  return normalized;
}

function isCustomer(user: ProvisionedUser): boolean {
  if (!user.subscriptionActive) return false;
  const plan = String(user.planType || '').trim().toLowerCase();
  return !['tester', 'trial', 'free'].includes(plan);
}

export function buildTargetMarketRows(
  geographies: ConversionTrafficGeography[],
  cities: ConversionTrafficCity[],
  marketMetrics: MetaMarketMetric[],
  provisionedUsers: ProvisionedUser[] = [],
): TargetMarketRow[] {
  const geographyByCountry = new Map(geographies.map((row) => [countryCode(row.countryCode), row]));
  const areaCounts = new Map<string, number>();
  const metaByCountry = new Map<string, MetaMarketMetric>();
  const trialCounts = new Map<string, number>();
  const customerCounts = new Map<string, number>();

  for (const city of cities) {
    const code = countryCode(city.countryCode);
    areaCounts.set(code, (areaCounts.get(code) ?? 0) + 1);
  }

  for (const row of marketMetrics) {
    const code = countryCode(row.countryCode);
    const current = metaByCountry.get(code) ?? {
      countryCode: code,
      currency: row.currency,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      landingPageViews: 0,
    };
    current.spend += row.spend;
    current.impressions += row.impressions;
    current.reach += row.reach;
    current.clicks += row.clicks;
    current.landingPageViews += row.landingPageViews;
    metaByCountry.set(code, current);
  }

  for (const user of provisionedUsers) {
    const code = countryCode(user.country || '') || UNKNOWN_COUNTRY;
    if (user.trialStartedAt) {
      trialCounts.set(code, (trialCounts.get(code) ?? 0) + 1);
    }
    if (isCustomer(user)) {
      customerCounts.set(code, (customerCounts.get(code) ?? 0) + 1);
    }
  }

  const totalMetaLandingPageViews = APAC_MARKET_CENTRES.reduce(
    (sum, market) => sum + (metaByCountry.get(market.code)?.landingPageViews ?? 0),
    0,
  );

  const rows: TargetMarketRow[] = APAC_MARKET_CENTRES.map((market) => {
    const meta = metaByCountry.get(market.code);
    const metaLandingPageViews = meta?.landingPageViews ?? 0;

    return {
      code: market.code,
      name: market.name,
      short: market.short,
      colour: market.colour,
      currency: meta?.currency ?? 'NZD',
      metaLandingPageViews,
      spend: meta?.spend ?? 0,
      impressions: meta?.impressions ?? 0,
      reach: meta?.reach ?? 0,
      clicks: meta?.clicks ?? 0,
      ownedSessions: geographyByCountry.get(market.code)?.landingSessions ?? 0,
      trialCount: trialCounts.get(market.code) ?? 0,
      customerCount: customerCounts.get(market.code) ?? 0,
      areas: areaCounts.get(market.code) ?? 0,
      sharePct: totalMetaLandingPageViews > 0 ? (metaLandingPageViews / totalMetaLandingPageViews) * 100 : 0,
    };
  });

  const unattributedTrialCount = trialCounts.get(UNKNOWN_COUNTRY) ?? 0;
  const unattributedCustomerCount = customerCounts.get(UNKNOWN_COUNTRY) ?? 0;

  if (unattributedTrialCount > 0 || unattributedCustomerCount > 0) {
    rows.push({
      code: UNKNOWN_TARGET_MARKET.code,
      name: UNKNOWN_TARGET_MARKET.name,
      short: UNKNOWN_TARGET_MARKET.short,
      colour: UNKNOWN_TARGET_MARKET.colour,
      currency: 'NZD',
      metaLandingPageViews: 0,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      ownedSessions: 0,
      trialCount: unattributedTrialCount,
      customerCount: unattributedCustomerCount,
      areas: 0,
      sharePct: 0,
    });
  }

  return rows;
}
