export interface GeoPoint {
  latitude: number | null;
  longitude: number | null;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export const APAC_MAP_SIZE = {
  width: 900,
  height: 520,
} as const;

export const APAC_MARKET_CENTRES = [
  { code: 'NZ', name: 'New Zealand', short: 'NZ', colour: '#22d3ee', latitude: -41.2, longitude: 174.3 },
  { code: 'AU', name: 'Australia', short: 'AUS', colour: '#60a5fa', latitude: -25.3, longitude: 133.8 },
  { code: 'HK', name: 'Hong Kong', short: 'HK', colour: '#f59e0b', latitude: 22.3, longitude: 114.2 },
] as const;

const MIN_LON = 90;
const MAX_LON = 180;
const MIN_LAT = -50;
const MAX_LAT = 55;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hasProjectableGeoPoint(point: GeoPoint): point is { latitude: number; longitude: number } {
  return (
    typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === 'number' &&
    Number.isFinite(point.longitude)
  );
}

export function projectApacPoint(point: GeoPoint): ProjectedPoint | null {
  if (!hasProjectableGeoPoint(point)) return null;

  const x = ((point.longitude - MIN_LON) / (MAX_LON - MIN_LON)) * APAC_MAP_SIZE.width;
  const y = ((MAX_LAT - point.latitude) / (MAX_LAT - MIN_LAT)) * APAC_MAP_SIZE.height;

  return {
    x: clamp(x, 25, APAC_MAP_SIZE.width - 25),
    y: clamp(y, 25, APAC_MAP_SIZE.height - 25),
  };
}

