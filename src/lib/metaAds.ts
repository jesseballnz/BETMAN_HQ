export interface MetaMarketMetric {
  countryCode: string;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
}

export interface MetaCampaignMetric {
  campaignId: string;
  campaign: string;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
}

interface MetaAction {
  action_type?: string;
  value?: string | number;
}

interface MetaInsightRow {
  account_currency?: string;
  campaign_id?: string;
  campaign_name?: string;
  country?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  clicks?: string | number;
  inline_link_clicks?: string | number;
  actions?: MetaAction[];
}

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  paging?: {
    next?: string;
  };
}

interface MetaAdAccount {
  id?: string;
  account_status?: number;
}

interface MetaAdAccountsResponse {
  data?: MetaAdAccount[];
  paging?: {
    next?: string;
  };
}

function toNumber(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function landingPageViews(actions: MetaAction[] | undefined): number {
  return toNumber(actions?.find((action) => action.action_type === 'landing_page_view')?.value);
}

function configuredAdAccountIds(): string[] {
  const raw = process.env.META_AD_ACCOUNT_IDS || process.env.META_AD_ACCOUNT_ID || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => id.replace(/^act_/, ''));
}

async function discoverAdAccountIds(token: string): Promise<string[]> {
  const version = process.env.META_ADS_API_VERSION || 'v20.0';
  const accountIds: string[] = [];
  const params = new URLSearchParams({
    access_token: token,
    fields: 'id,account_status',
    limit: '100',
  });
  let nextUrl: string | null = `https://graph.facebook.com/${version}/me/adaccounts?${params.toString()}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Meta Ads account discovery -> ${res.status}: ${text}`);
    }

    const body = (await res.json()) as MetaAdAccountsResponse;
    for (const account of body.data ?? []) {
      // Meta still returns usable accounts with statuses like 3 and 9 for reporting.
      // Keep any discovered account unless Meta explicitly omits the id.
      if (account.id && account.account_status !== 2) {
        accountIds.push(account.id.replace(/^act_/, ''));
      }
    }
    nextUrl = body.paging?.next ?? null;
  }

  return accountIds;
}

function defaultTimeRange(): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 30);

  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export function aggregateMetaMarketMetrics(rows: MetaInsightRow[]): MetaMarketMetric[] {
  const byCountry = new Map<string, MetaMarketMetric>();

  for (const row of rows) {
    const countryCode = String(row.country || '').trim().toUpperCase();
    if (!countryCode) continue;

    const currency = String(row.account_currency || process.env.META_ADS_CURRENCY || 'NZD').toUpperCase();
    const key = `${countryCode}:${currency}`;
    const current = byCountry.get(key) ?? {
      countryCode,
      currency,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      landingPageViews: 0,
    };

    current.spend += toNumber(row.spend);
    current.impressions += toNumber(row.impressions);
    current.reach += toNumber(row.reach);
    current.clicks += toNumber(row.inline_link_clicks ?? row.clicks);
    current.landingPageViews += landingPageViews(row.actions);
    byCountry.set(key, current);
  }

  return Array.from(byCountry.values()).sort((a, b) => b.landingPageViews - a.landingPageViews);
}

export function aggregateMetaCampaignMetrics(rows: MetaInsightRow[]): MetaCampaignMetric[] {
  const byCampaign = new Map<string, MetaCampaignMetric>();

  for (const row of rows) {
    const campaignId = String(row.campaign_id || row.campaign_name || 'unassigned').trim();
    if (!campaignId) continue;

    const campaign = String(row.campaign_name || row.campaign_id || 'unassigned').trim();
    const currency = String(row.account_currency || process.env.META_ADS_CURRENCY || 'NZD').toUpperCase();
    const key = `${campaignId}:${currency}`;
    const current = byCampaign.get(key) ?? {
      campaignId,
      campaign,
      currency,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      landingPageViews: 0,
    };

    current.spend += toNumber(row.spend);
    current.impressions += toNumber(row.impressions);
    current.reach += toNumber(row.reach);
    current.clicks += toNumber(row.inline_link_clicks ?? row.clicks);
    current.landingPageViews += landingPageViews(row.actions);
    byCampaign.set(key, current);
  }

  return Array.from(byCampaign.values()).sort((a, b) => b.clicks - a.clicks);
}

async function fetchMetaMarketInsightsForAccount(accountId: string, token: string): Promise<MetaInsightRow[]> {
  const version = process.env.META_ADS_API_VERSION || 'v20.0';
  const timeRange = defaultTimeRange();
  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = null;

  const params = new URLSearchParams({
    access_token: token,
    level: 'campaign',
    breakdowns: 'country',
    fields: 'account_currency,spend,impressions,reach,clicks,inline_link_clicks,actions',
    time_range: JSON.stringify(timeRange),
    limit: '500',
  });

  nextUrl = `https://graph.facebook.com/${version}/act_${accountId}/insights?${params.toString()}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Meta Ads insights act_${accountId} -> ${res.status}: ${text}`);
    }

    const body = (await res.json()) as MetaInsightsResponse;
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ?? null;
  }

  return rows;
}

async function fetchMetaCampaignInsightsForAccount(accountId: string, token: string): Promise<MetaInsightRow[]> {
  const version = process.env.META_ADS_API_VERSION || 'v20.0';
  const timeRange = defaultTimeRange();
  const rows: MetaInsightRow[] = [];
  let nextUrl: string | null = null;

  const params = new URLSearchParams({
    access_token: token,
    level: 'campaign',
    fields: 'campaign_id,campaign_name,account_currency,spend,impressions,reach,clicks,inline_link_clicks,actions',
    time_range: JSON.stringify(timeRange),
    limit: '500',
  });

  nextUrl = `https://graph.facebook.com/${version}/act_${accountId}/insights?${params.toString()}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Meta Ads campaign insights act_${accountId} -> ${res.status}: ${text}`);
    }

    const body = (await res.json()) as MetaInsightsResponse;
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ?? null;
  }

  return rows;
}

export async function fetchMetaMarketMetrics(): Promise<MetaMarketMetric[]> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return [];

  const accountIds = configuredAdAccountIds();
  const resolvedAccountIds = accountIds.length > 0 ? accountIds : await discoverAdAccountIds(token);
  if (resolvedAccountIds.length === 0) return [];

  const rows = (await Promise.all(
    resolvedAccountIds.map((accountId) => fetchMetaMarketInsightsForAccount(accountId, token)),
  )).flat();

  return aggregateMetaMarketMetrics(rows);
}

export async function fetchMetaCampaignMetrics(): Promise<MetaCampaignMetric[]> {
  const token = process.env.META_ADS_ACCESS_TOKEN;
  if (!token) return [];

  const accountIds = configuredAdAccountIds();
  const resolvedAccountIds = accountIds.length > 0 ? accountIds : await discoverAdAccountIds(token);
  if (resolvedAccountIds.length === 0) return [];

  const rows = (await Promise.all(
    resolvedAccountIds.map((accountId) => fetchMetaCampaignInsightsForAccount(accountId, token)),
  )).flat();

  return aggregateMetaCampaignMetrics(rows);
}
