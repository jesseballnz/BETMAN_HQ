import { aggregateMetaCampaignMetrics, aggregateMetaMarketMetrics, fetchMetaMarketMetrics } from '@/lib/metaAds';

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

describe('fetchMetaMarketMetrics', () => {
  const originalFetch = global.fetch;
  const originalEnv = {
    META_ADS_ACCESS_TOKEN: process.env.META_ADS_ACCESS_TOKEN,
    META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID,
    META_AD_ACCOUNT_IDS: process.env.META_AD_ACCOUNT_IDS,
  };

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.META_ADS_ACCESS_TOKEN = originalEnv.META_ADS_ACCESS_TOKEN;
    process.env.META_AD_ACCOUNT_ID = originalEnv.META_AD_ACCOUNT_ID;
    process.env.META_AD_ACCOUNT_IDS = originalEnv.META_AD_ACCOUNT_IDS;
    jest.restoreAllMocks();
  });

  test('keeps discovered accounts with non-1 statuses', async () => {
    process.env.META_ADS_ACCESS_TOKEN = 'test-token';
    delete process.env.META_AD_ACCOUNT_ID;
    delete process.env.META_AD_ACCOUNT_IDS;

    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/me/adaccounts')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 'act_111', account_status: 9 },
              { id: 'act_222', account_status: 3 },
            ],
          }),
          text: async () => '',
        } as Response;
      }

      if (url.includes('/act_111/insights')) {
        return {
          ok: true,
          json: async () => ({ data: [{ country: 'NZ', account_currency: 'NZD', spend: '10', impressions: '100', reach: '90', clicks: '5', inline_link_clicks: '4', actions: [{ action_type: 'landing_page_view', value: '3' }] }] }),
          text: async () => '',
        } as Response;
      }

      if (url.includes('/act_222/insights')) {
        return {
          ok: true,
          json: async () => ({ data: [{ country: 'AU', account_currency: 'NZD', spend: '20', impressions: '200', reach: '180', clicks: '8', inline_link_clicks: '6', actions: [{ action_type: 'landing_page_view', value: '4' }] }] }),
          text: async () => '',
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    global.fetch = fetchMock as typeof fetch;

    await expect(fetchMetaMarketMetrics()).resolves.toEqual([
      {
        countryCode: 'AU',
        currency: 'NZD',
        spend: 20,
        impressions: 200,
        reach: 180,
        clicks: 6,
        landingPageViews: 4,
      },
      {
        countryCode: 'NZ',
        currency: 'NZD',
        spend: 10,
        impressions: 100,
        reach: 90,
        clicks: 4,
        landingPageViews: 3,
      },
    ]);
  });
});
