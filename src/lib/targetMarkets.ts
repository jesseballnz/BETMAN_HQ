import { APAC_MARKET_CENTRES } from '@/lib/geoProjection';
import type { ConversionTrafficCity, ConversionTrafficGeography } from '@/lib/hqConversion';
import type { MetaMarketMetric } from '@/lib/metaAds';

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
  areas: number;
  sharePct: number;
}

function countryCode(value: string): string {
  return value.toUpperCase();
}

export function buildTargetMarketRows(
  geographies: ConversionTrafficGeography[],
  cities: ConversionTrafficCity[],
  marketMetrics: MetaMarketMetric[],
): TargetMarketRow[] {
  const geographyByCountry = new Map(geographies.map((row) => [countryCode(row.countryCode), row]));
  const areaCounts = new Map<string, number>();
  const metaByCountry = new Map<string, MetaMarketMetric>();

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

  const totalMetaLandingPageViews = APAC_MARKET_CENTRES.reduce(
    (sum, market) => sum + (metaByCountry.get(market.code)?.landingPageViews ?? 0),
    0,
  );

  return APAC_MARKET_CENTRES.map((market) => {
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
      areas: areaCounts.get(market.code) ?? 0,
      sharePct: totalMetaLandingPageViews > 0 ? (metaLandingPageViews / totalMetaLandingPageViews) * 100 : 0,
    };
  });
}
