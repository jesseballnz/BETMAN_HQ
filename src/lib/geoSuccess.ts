import type { ConversionTrafficCity, ConversionTrafficGeography } from '@/lib/hqConversion';

export interface GeoSuccessRow {
  countryCode: string;
  country: string;
  landingSessions: number;
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

export function buildGeoSuccessSummary(
  geographies: ConversionTrafficGeography[],
  cities: ConversionTrafficCity[],
  fallbackLandingSessions = 0,
): GeoSuccessSummary {
  const landingSessions = geographies.reduce((sum, row) => sum + row.landingSessions, 0) || fallbackLandingSessions;
  const areaCounts = new Map<string, number>();

  for (const city of cities) {
    const code = countryCode(city.countryCode);
    areaCounts.set(code, (areaCounts.get(code) ?? 0) + 1);
  }

  const rows = geographies
    .map((row) => ({
      countryCode: countryCode(row.countryCode),
      country: row.country,
      landingSessions: row.landingSessions,
      areas: areaCounts.get(countryCode(row.countryCode)) ?? 0,
      sharePct: landingSessions > 0 ? (row.landingSessions / landingSessions) * 100 : 0,
    }))
    .sort((a, b) => b.landingSessions - a.landingSessions);

  return {
    rows,
    landingSessions,
    countries: geographies.length,
    areas: cities.length,
  };
}
