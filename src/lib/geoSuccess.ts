import type { ConversionTrafficCity, ConversionTrafficGeography } from '@/lib/hqConversion';
import { APAC_MARKET_CENTRES } from '@/lib/geoProjection';

export interface GeoSuccessRow {
  countryCode: string;
  country: string;
  landingSessions: number;
  metaLandingPageViews: number;
  areas: number;
  sharePct: number;
}

export interface GeoSuccessSummary {
  rows: GeoSuccessRow[];
  landingSessions: number;
  countries: number;
  areas: number;
}

function countryCode(value: string): string {
  return value.toUpperCase();
}

interface MarketMetric {
  countryCode: string;
  landingPageViews: number;
}

export function buildGeoSuccessSummary(
  geographies: ConversionTrafficGeography[],
  cities: ConversionTrafficCity[],
  fallbackLandingSessions = 0,
  marketMetrics: MarketMetric[] = [],
): GeoSuccessSummary {
  const landingSessions = geographies.reduce((sum, row) => sum + row.landingSessions, 0) || fallbackLandingSessions;
  const areaCounts = new Map<string, number>();
  const metaLandingViews = new Map<string, number>();
  const marketNames = new Map<string, string>(APAC_MARKET_CENTRES.map((market) => [market.code, market.name]));

  for (const city of cities) {
    const code = countryCode(city.countryCode);
    areaCounts.set(code, (areaCounts.get(code) ?? 0) + 1);
  }

  for (const row of marketMetrics) {
    const code = countryCode(row.countryCode);
    metaLandingViews.set(code, (metaLandingViews.get(code) ?? 0) + row.landingPageViews);
  }

  const geographyByCountry = new Map(geographies.map((row) => [countryCode(row.countryCode), row]));
  const rowCountryCodes = new Set([
    ...Array.from(geographyByCountry.keys()),
    ...Array.from(metaLandingViews.entries())
      .filter(([, landingPageViews]) => landingPageViews > 0)
      .map(([code]) => code),
  ]);

  const rows = Array.from(rowCountryCodes)
    .map((code) => {
      const geography = geographyByCountry.get(code);
      const ownedSessions = geography?.landingSessions ?? 0;

      return {
        countryCode: code,
        country: geography?.country ?? marketNames.get(code) ?? code,
        landingSessions: ownedSessions,
        metaLandingPageViews: metaLandingViews.get(code) ?? 0,
        areas: areaCounts.get(code) ?? 0,
        sharePct: landingSessions > 0 ? (ownedSessions / landingSessions) * 100 : 0,
      };
    })
    .sort((a, b) => {
      const ownedDiff = b.landingSessions - a.landingSessions;
      if (ownedDiff !== 0) return ownedDiff;
      return b.metaLandingPageViews - a.metaLandingPageViews;
    });

  return {
    rows,
    landingSessions,
    countries: geographies.length,
    areas: cities.length,
  };
}
