import { aggregateMetaCampaignMetrics, aggregateMetaMarketMetrics } from '@/lib/metaAds';

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

describe('aggregateMetaCampaignMetrics', () => {
  test('aggregates campaign delivery for CTR ranking', () => {
    const rows = aggregateMetaCampaignMetrics([
      {
        campaign_id: '123',
        campaign_name: 'Karaka Prospecting',
        account_currency: 'NZD',
        spend: '20',
        impressions: '1000',
        reach: '700',
        inline_link_clicks: '40',
        actions: [{ action_type: 'landing_page_view', value: '30' }],
      },
      {
        campaign_id: '123',
        campaign_name: 'Karaka Prospecting',
        account_currency: 'NZD',
        spend: '5',
        impressions: '500',
        reach: '300',
        clicks: '10',
        actions: [{ action_type: 'landing_page_view', value: '5' }],
      },
    ]);

    expect(rows).toEqual([
      {
        campaignId: '123',
        campaign: 'Karaka Prospecting',
        currency: 'NZD',
        spend: 25,
        impressions: 1500,
        reach: 1000,
        clicks: 50,
        landingPageViews: 35,
      },
    ]);
  });
});
