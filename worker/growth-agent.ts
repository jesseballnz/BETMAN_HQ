import { appendFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { aggregateFunnel, decidePortfolio, DEFAULT_GROWTH_GUARDRAILS } from '../src/lib/growth/decisionEngine';
import type { CampaignPerformance, GrowthGuardrails, GrowthSnapshot } from '../src/lib/growth/types';

interface MetaAction { action_type?: string; value?: string | number }
interface MetaRow {
  account_currency?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  inline_link_clicks?: string | number;
  actions?: MetaAction[];
}

interface CoreUser {
  createdAt?: string;
  trialStartedAt?: string;
  campaign?: string;
  planType?: string;
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
}

interface CoreSummary { ok?: boolean; provisionedUsers?: CoreUser[] }

const OUTPUT = process.env.BETMAN_GROWTH_STATUS || '/opt/betman/betman_hq/runtime/growth-agent/latest.json';
const LEDGER = process.env.BETMAN_GROWTH_LEDGER || '/opt/betman/betman_hq/runtime/growth-agent/audit.jsonl';
const TIME_ZONE = process.env.BETMAN_GROWTH_TIME_ZONE || 'Pacific/Auckland';

function numberValue(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(row: MetaRow, type: string): number {
  return (row.actions || [])
    .filter((action) => action.action_type === type)
    .reduce((sum, action) => sum + numberValue(action.value), 0);
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function lastCompleteSevenDays(now = new Date(), timeZone = TIME_ZONE) {
  const localToday = dateInTimeZone(now, timeZone);
  const localMiddayUtc = new Date(`${localToday}T12:00:00Z`);
  const until = new Date(localMiddayUtc);
  until.setUTCDate(until.getUTCDate() - 1);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 6);
  return { since: dateInTimeZone(since, 'UTC'), until: dateInTimeZone(until, 'UTC'), timeZone };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const rows: T[] = [];
  let next: string | null = url;
  while (next) {
    const body: { data?: T[]; paging?: { next?: string } } = await fetchJson(next);
    rows.push(...(body.data || []));
    next = body.paging?.next || null;
  }
  return rows;
}

async function metaAccountIds(token: string, version: string): Promise<string[]> {
  const configured = (process.env.META_AD_ACCOUNT_IDS || process.env.META_AD_ACCOUNT_ID || '')
    .split(',').map((value) => value.trim().replace(/^act_/, '')).filter(Boolean);
  if (configured.length) return configured;
  const params = new URLSearchParams({ access_token: token, fields: 'id,account_status', limit: '100' });
  const accounts = await fetchAllPages<{ id?: string; account_status?: number }>(
    `https://graph.facebook.com/${version}/me/adaccounts?${params}`,
  );
  return accounts
    .filter((account) => account.id && account.account_status !== 2)
    .map((account) => String(account.id).replace(/^act_/, ''));
}

async function fetchMetaCampaigns(window: ReturnType<typeof lastCompleteSevenDays>): Promise<CampaignPerformance[]> {
  const token = process.env.META_ADS_ACCESS_TOKEN || '';
  if (!token) throw new Error('META_ADS_ACCESS_TOKEN is not configured');
  const version = process.env.META_ADS_API_VERSION || 'v20.0';
  const accountIds = await metaAccountIds(token, version);
  const rows: MetaRow[] = [];
  for (const accountId of accountIds) {
    const params = new URLSearchParams({
      access_token: token,
      level: 'campaign',
      fields: 'account_currency,campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions',
      time_range: JSON.stringify({ since: window.since, until: window.until }),
      limit: '500',
    });
    rows.push(...await fetchAllPages<MetaRow>(
      `https://graph.facebook.com/${version}/act_${accountId}/insights?${params}`,
    ));
  }

  const campaigns = new Map<string, CampaignPerformance>();
  for (const row of rows) {
    const campaignId = String(row.campaign_id || row.campaign_name || 'unassigned');
    const current = campaigns.get(campaignId) || {
      campaignId,
      campaign: String(row.campaign_name || row.campaign_id || 'Unassigned'),
      currency: String(row.account_currency || 'NZD'),
      spend: 0,
      impressions: 0,
      clicks: 0,
      landingPageViews: 0,
      signups: 0,
      trials: 0,
      paid: 0,
    };
    current.spend += numberValue(row.spend);
    current.impressions += numberValue(row.impressions);
    current.clicks += numberValue(row.inline_link_clicks ?? row.clicks);
    current.landingPageViews += actionValue(row, 'landing_page_view');
    campaigns.set(campaignId, current);
  }
  return Array.from(campaigns.values());
}

function dateStartUtc(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

async function fetchCoreOutcomes(
  campaigns: CampaignPerformance[],
  window: ReturnType<typeof lastCompleteSevenDays>,
) {
  const baseUrl = (process.env.BETMAN_CORE_URL || '').replace(/\/$/, '');
  const token = process.env.BETMAN_HQ_AUTH_SUMMARY_TOKEN || '';
  if (!baseUrl || !token) throw new Error('Core auth summary is not configured');
  const summary = await fetchJson<CoreSummary>(`${baseUrl}/api/hq/auth-summary`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!summary.ok) throw new Error('Core auth summary returned ok=false');

  const start = dateStartUtc(window.since);
  const end = dateStartUtc(window.until) + 24 * 60 * 60 * 1000;
  const byCampaign = new Map(campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const unattributed = { commercialSignups: 0, trials: 0, paid: 0 };

  for (const user of summary.provisionedUsers || []) {
    const created = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    if (!created || created < start || created >= end) continue;
    if (String(user.planType || '').toLowerCase() === 'tester') continue;
    const campaignId = String(user.campaign || '').trim();
    const target = campaignId && campaignId.toLowerCase() !== 'unassigned' ? byCampaign.get(campaignId) : undefined;
    if (target) {
      target.signups += 1;
      if (user.trialStartedAt) target.trials += 1;
    } else {
      unattributed.commercialSignups += 1;
      if (user.trialStartedAt) unattributed.trials += 1;
    }
  }
  return unattributed;
}

function guardrailsFromEnvironment(): GrowthGuardrails {
  const defaults = DEFAULT_GROWTH_GUARDRAILS;
  const configured = (name: string, fallback: number) => numberValue(process.env[name] || fallback);
  return {
    zeroLandingPauseSpend: configured('BETMAN_GROWTH_ZERO_LPV_PAUSE_SPEND', defaults.zeroLandingPauseSpend),
    minimumLandingSample: configured('BETMAN_GROWTH_MIN_LPV_SAMPLE', defaults.minimumLandingSample),
    maximumCostPerLanding: configured('BETMAN_GROWTH_MAX_COST_PER_LPV', defaults.maximumCostPerLanding),
    maximumCostPerTrial: configured('BETMAN_GROWTH_MAX_COST_PER_TRIAL', defaults.maximumCostPerTrial),
    maximumPaidCac: configured('BETMAN_GROWTH_MAX_PAID_CAC', defaults.maximumPaidCac),
    minimumTrialsToScale: configured('BETMAN_GROWTH_MIN_TRIALS_TO_SCALE', defaults.minimumTrialsToScale),
    minimumPaidToScale: configured('BETMAN_GROWTH_MIN_PAID_TO_SCALE', defaults.minimumPaidToScale),
    maximumBudgetChangePct: Math.min(20, configured('BETMAN_GROWTH_MAX_BUDGET_CHANGE_PCT', defaults.maximumBudgetChangePct)),
  };
}

async function atomicJsonWrite(file: string, payload: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o640 });
  await rename(temporary, file);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const window = lastCompleteSevenDays();
  const failures: string[] = [];
  const sources: Record<string, string> = {};
  let campaigns: CampaignPerformance[] = [];
  let unattributed = { commercialSignups: 0, trials: 0, paid: 0 };

  try {
    campaigns = await fetchMetaCampaigns(window);
    sources.meta = 'live';
  } catch (error) {
    sources.meta = 'failed';
    failures.push(error instanceof Error ? error.message : 'Meta collection failed');
  }
  try {
    unattributed = await fetchCoreOutcomes(campaigns, window);
    sources.core = 'live';
  } catch (error) {
    sources.core = 'failed';
    failures.push(error instanceof Error ? error.message : 'Core collection failed');
  }

  const snapshot: GrowthSnapshot = {
    schemaVersion: 1,
    generatedAt,
    mode: 'dry-run',
    window,
    health: { ok: failures.length === 0, failures, sources },
    funnel: aggregateFunnel(campaigns, unattributed),
    campaigns,
    decisions: decidePortfolio(campaigns, guardrailsFromEnvironment()),
  };
  await atomicJsonWrite(OUTPUT, snapshot);
  await mkdir(path.dirname(LEDGER), { recursive: true });
  await appendFile(LEDGER, `${JSON.stringify(snapshot)}\n`, { mode: 0o640 });
  process.stdout.write(`${JSON.stringify({ ok: snapshot.health.ok, output: OUTPUT, decisions: snapshot.decisions.length })}\n`);
  if (!snapshot.health.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
