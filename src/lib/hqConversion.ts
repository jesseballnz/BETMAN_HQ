import type { CoreAuthSummary } from '@/lib/betmanCore';

export interface ConversionTrafficCampaign {
  platform: string;
  campaign: string;
  landingSessions: number;
  signups: number;
  trials: number;
  verifiedTrials: number;
  conversions: number;
}

export interface ConversionTrafficGeography {
  countryCode: string;
  country: string;
  landingSessions: number;
}

export interface ConversionTrafficCity extends ConversionTrafficGeography {
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ConversionTraffic {
  available: boolean;
  stale: boolean;
  generatedAt: string | null;
  windowDays: number;
  totals: Record<string, unknown>;
  campaigns: ConversionTrafficCampaign[];
  daily: Array<Record<string, unknown>>;
  geographies: ConversionTrafficGeography[];
  cities: ConversionTrafficCity[];
  geographyResolution: {
    cityResolvedSessions: number;
    totalSessions: number;
    cityDatabase: string;
  };
  sources: Record<string, string>;
}

export const EMPTY_CONVERSION_TRAFFIC: ConversionTraffic = {
  available: false,
  stale: true,
  generatedAt: null,
  windowDays: 30,
  totals: {},
  campaigns: [],
  daily: [],
  geographies: [],
  cities: [],
  geographyResolution: { cityResolvedSessions: 0, totalSessions: 0, cityDatabase: '' },
  sources: {},
};

function numberValue(value: unknown, fallback = 0): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeConversionTraffic(summary: CoreAuthSummary | null): ConversionTraffic {
  const traffic = summary?.conversionTraffic;
  if (!traffic || typeof traffic !== 'object') return EMPTY_CONVERSION_TRAFFIC;

  const raw = traffic as Record<string, unknown>;
  const geographyResolution = raw.geographyResolution && typeof raw.geographyResolution === 'object'
    ? raw.geographyResolution as Record<string, unknown>
    : {};

  return {
    ...EMPTY_CONVERSION_TRAFFIC,
    available: Boolean(raw.available),
    stale: Boolean(raw.stale),
    generatedAt: stringValue(raw.generatedAt, null as unknown as string) || null,
    windowDays: numberValue(raw.windowDays, 30),
    totals: raw.totals && typeof raw.totals === 'object' ? raw.totals as Record<string, unknown> : {},
    campaigns: Array.isArray(raw.campaigns) ? raw.campaigns.map((row) => {
      const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      return {
        platform: stringValue(item.platform, 'unattributed'),
        campaign: stringValue(item.campaign, 'unassigned'),
        landingSessions: numberValue(item.landingSessions),
        signups: numberValue(item.signups),
        trials: numberValue(item.trials),
        verifiedTrials: numberValue(item.verifiedTrials),
        conversions: numberValue(item.conversions),
      };
    }) : [],
    daily: Array.isArray(raw.daily) ? raw.daily.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [],
    geographies: Array.isArray(raw.geographies) ? raw.geographies.map((row) => {
      const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      return {
        countryCode: stringValue(item.countryCode).toUpperCase(),
        country: stringValue(item.country),
        landingSessions: numberValue(item.landingSessions),
      };
    }).filter((row) => row.countryCode) : [],
    cities: Array.isArray(raw.cities) ? raw.cities.map((row) => {
      const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      return {
        countryCode: stringValue(item.countryCode).toUpperCase(),
        country: stringValue(item.country),
        region: stringValue(item.region),
        city: stringValue(item.city),
        latitude: item.latitude === null || item.latitude === undefined ? null : numberValue(item.latitude, NaN),
        longitude: item.longitude === null || item.longitude === undefined ? null : numberValue(item.longitude, NaN),
        landingSessions: numberValue(item.landingSessions),
      };
    }).map((row) => ({
      ...row,
      latitude: Number.isFinite(row.latitude) ? row.latitude : null,
      longitude: Number.isFinite(row.longitude) ? row.longitude : null,
    })).filter((row) => row.countryCode && row.city) : [],
    geographyResolution: {
      cityResolvedSessions: numberValue(geographyResolution.cityResolvedSessions),
      totalSessions: numberValue(geographyResolution.totalSessions),
      cityDatabase: stringValue(geographyResolution.cityDatabase),
    },
    sources: raw.sources && typeof raw.sources === 'object' ? raw.sources as Record<string, string> : {},
  };
}

