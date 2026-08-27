/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import LandingMap from '@/app/conversion/LandingMap';
import { APAC_MARKET_CENTRES, projectApacPoint } from '@/lib/geoProjection';
import { normalizeConversionTraffic } from '@/lib/hqConversion';

const geographies = [
  { countryCode: 'HK', country: 'Hong Kong', landingSessions: 1 },
  { countryCode: 'NZ', country: 'New Zealand', landingSessions: 12 },
  { countryCode: 'AU', country: 'Australia', landingSessions: 18 },
];

const cities = [
  { countryCode: 'HK', country: 'Hong Kong', region: 'Hong Kong', city: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, landingSessions: 1 },
  { countryCode: 'NZ', country: 'New Zealand', region: 'Auckland', city: 'Auckland', latitude: -36.8509, longitude: 174.7645, landingSessions: 8 },
  { countryCode: 'AU', country: 'Australia', region: 'Victoria', city: 'Melbourne', latitude: -37.8136, longitude: 144.9631, landingSessions: 7 },
];

describe('LandingMap', () => {
  test('renders every projectable city dot and opens the full dataset modal', () => {
    const { getAllByTestId } = render(
      <LandingMap
        rows={geographies}
        cities={cities}
        resolution={{ cityResolvedSessions: 16, totalSessions: 31 }}
        marketMetrics={[{ countryCode: 'HK', currency: 'NZD', spend: 20, impressions: 1000, reach: 500, clicks: 59, landingPageViews: 50 }]}
      />,
    );

    expect(getAllByTestId('landing-city-dot')).toHaveLength(cities.length);

    fireEvent.click(screen.getAllByRole('button', { name: 'View full Hong Kong dataset' })[0]);

    expect(screen.getByRole('dialog', { name: 'Hong Kong - Full Area Dataset' })).toBeInTheDocument();
    expect(screen.getAllByText('Hong Kong').length).toBeGreaterThan(0);
    expect(screen.getByText('Meta LPV')).toBeInTheDocument();
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  test('opens the full area dataset with every area that recorded traffic', () => {
    render(
      <LandingMap
        rows={geographies}
        cities={cities}
        resolution={{ cityResolvedSessions: 16, totalSessions: 31 }}
        marketMetrics={[]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View every area that recorded landing traffic' }));

    expect(screen.getByRole('dialog', { name: 'All Markets - Full Area Dataset' })).toBeInTheDocument();
    expect(screen.getAllByText('Areas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Auckland').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Melbourne').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hong Kong').length).toBeGreaterThan(0);
  });

  test('uses the same APAC projection for country bubbles and city dots', () => {
    const hongKongMarket = APAC_MARKET_CENTRES.find((market) => market.code === 'HK');
    expect(hongKongMarket).toBeDefined();

    const marketPoint = projectApacPoint(hongKongMarket!);
    const cityPoint = projectApacPoint(cities[0]);

    expect(marketPoint).not.toBeNull();
    expect(cityPoint).not.toBeNull();
    expect(Math.abs(marketPoint!.x - cityPoint!.x)).toBeLessThan(3);
    expect(Math.abs(marketPoint!.y - cityPoint!.y)).toBeLessThan(3);
  });

  test('normalizes Core conversion traffic without dropping city coordinates', () => {
    const traffic = normalizeConversionTraffic({
      ok: true,
      source: 'core-auth-state',
      fetchedAt: new Date().toISOString(),
      uniqueAccounts: 37,
      activeAccounts: 37,
      passwordPendingAccounts: 0,
      apiKeysActive: 0,
      planCounts: {},
      statusCounts: {},
      conversionTraffic: {
        available: true,
        cities,
        geographies,
        geographyResolution: { cityResolvedSessions: 16, totalSessions: 31, cityDatabase: 'GeoLite2' },
      },
    });

    expect(traffic.cities).toHaveLength(3);
    expect(traffic.cities[0].latitude).toBe(22.3193);
    expect(traffic.geographies.map((row) => row.countryCode)).toEqual(['HK', 'NZ', 'AU']);
  });
});
