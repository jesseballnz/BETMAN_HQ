import { buildGeoSuccessSummary } from '@/lib/geoSuccess';

describe('buildGeoSuccessSummary', () => {
  test('counts owned landing countries and areas for Geo Success bars', () => {
    const summary = buildGeoSuccessSummary(
      [
        { countryCode: 'NZ', country: 'New Zealand', landingSessions: 227 },
        { countryCode: 'AU', country: 'Australia', landingSessions: 58 },
        { countryCode: 'HK', country: 'Hong Kong', landingSessions: 0 },
      ],
      [
        { countryCode: 'NZ', country: 'New Zealand', region: 'Auckland', city: 'Auckland', latitude: -36.85, longitude: 174.76, landingSessions: 48 },
        { countryCode: 'NZ', country: 'New Zealand', region: 'Waikato', city: 'Hamilton', latitude: -37.78, longitude: 175.28, landingSessions: 14 },
        { countryCode: 'AU', country: 'Australia', region: 'Queensland', city: 'Brisbane', latitude: -27.47, longitude: 153.03, landingSessions: 9 },
      ],
    );

    expect(summary.landingSessions).toBe(285);
    expect(summary.countries).toBe(3);
    expect(summary.areas).toBe(3);
    expect(summary.rows).toEqual([
      { countryCode: 'NZ', country: 'New Zealand', landingSessions: 227, metaLandingPageViews: 0, areas: 2, sharePct: expect.closeTo(79.649, 3) },
      { countryCode: 'AU', country: 'Australia', landingSessions: 58, metaLandingPageViews: 0, areas: 1, sharePct: expect.closeTo(20.351, 3) },
      { countryCode: 'HK', country: 'Hong Kong', landingSessions: 0, metaLandingPageViews: 0, areas: 0, sharePct: 0 },
    ]);
  });

  test('keeps Hong Kong visible when Meta has landing views but owned GeoIP has no HK sessions', () => {
    const summary = buildGeoSuccessSummary(
      [
        { countryCode: 'NZ', country: 'New Zealand', landingSessions: 227 },
        { countryCode: 'AU', country: 'Australia', landingSessions: 58 },
      ],
      [
        { countryCode: 'NZ', country: 'New Zealand', region: 'Auckland', city: 'Auckland', latitude: -36.85, longitude: 174.76, landingSessions: 48 },
        { countryCode: 'AU', country: 'Australia', region: 'Queensland', city: 'Brisbane', latitude: -27.47, longitude: 153.03, landingSessions: 9 },
      ],
      285,
      [
        { countryCode: 'HK', landingPageViews: 50 },
      ],
    );

    expect(summary.rows).toContainEqual({
      countryCode: 'HK',
      country: 'Hong Kong',
      landingSessions: 0,
      metaLandingPageViews: 50,
      areas: 0,
      sharePct: 0,
    });
  });
});
