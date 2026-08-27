import { buildTargetMarketRows } from '@/lib/targetMarkets';

describe('buildTargetMarketRows', () => {
  test('keeps Hong Kong visible as a target market even with zero owned sessions', () => {
    const rows = buildTargetMarketRows(
      [
        { countryCode: 'NZ', country: 'New Zealand', landingSessions: 227 },
        { countryCode: 'AU', country: 'Australia', landingSessions: 59 },
      ],
      [
        { countryCode: 'NZ', country: 'New Zealand', region: 'Auckland', city: 'Auckland', latitude: -36.85, longitude: 174.76, landingSessions: 48 },
        { countryCode: 'AU', country: 'Australia', region: 'Queensland', city: 'Brisbane', latitude: -27.47, longitude: 153.03, landingSessions: 9 },
      ],
      [
        { countryCode: 'NZ', currency: 'NZD', spend: 88.5, impressions: 53273, reach: 13418, clicks: 242, landingPageViews: 159 },
        { countryCode: 'AU', currency: 'NZD', spend: 39.31, impressions: 4269, reach: 2861, clicks: 90, landingPageViews: 77 },
        { countryCode: 'HK', currency: 'NZD', spend: 13.83, impressions: 1593, reach: 1310, clicks: 59, landingPageViews: 50 },
      ],
    );

    expect(rows.map((row) => row.code)).toEqual(['NZ', 'AU', 'HK']);
    expect(rows.find((row) => row.code === 'HK')).toMatchObject({
      name: 'Hong Kong',
      metaLandingPageViews: 50,
      ownedSessions: 0,
      areas: 0,
      clicks: 59,
      spend: 13.83,
    });
  });
});
