import { aggregateMetaMarketMetrics } from '@/lib/metaAds';

describe('aggregateMetaMarketMetrics', () => {
  test('preserves Hong Kong landing-page views from Meta actions', () => {
    const rows = aggregateMetaMarketMetrics([
      {
        country: 'HK',
        account_currency: 'NZD',
        spend: '12.34',
        impressions: '1000',
        reach: '750',
        clicks: '51',
        inline_link_clicks: '42',
        actions: [
          { action_type: 'link_click', value: '59' },
          { action_type: 'landing_page_view', value: '50' },
        ],
      },
      {
        country: 'hk',
        account_currency: 'NZD',
        spend: '7.66',
        impressions: '500',
        reach: '250',
        clicks: '10',
        actions: [{ action_type: 'landing_page_view', value: '0' }],
      },
    ]);

    expect(rows).toEqual([
      {
        countryCode: 'HK',
        currency: 'NZD',
        spend: 20,
        impressions: 1500,
        reach: 1000,
        clicks: 52,
        landingPageViews: 50,
      },
    ]);
  });
});
