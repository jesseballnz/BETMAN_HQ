import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchStripeSubscriberCounts } from '../src/lib/stripe';
import { attributeUserOutcomes } from '../src/lib/growth/attribution';
import { aggregateFunnel, decidePortfolio, DEFAULT_GROWTH_GUARDRAILS } from '../src/lib/growth/decisionEngine';
import { executeGrowthActions, verifyMetaWritePermission, type GrowthExecutionConfig } from '../src/lib/growth/executor';
import type { CampaignPerformance, GrowthAutomationState, GrowthGuardrails, GrowthSnapshot } from '../src/lib/growth/types';

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
  email?: string;
  stripeCustomerId?: string;
  createdAt?: string;
  trialStartedAt?: string;
  campaign?: string;
  campaignId?: string;
  planType?: string;
  subscriptionActive?: boolean;
  subscriptionStatus?: string;
}

interface CoreSummary { ok?: boolean; provisionedUsers?: CoreUser[] }

const OUTPUT = process.env.BETMAN_GROWTH_STATUS || '/opt/betman/betman_hq/runtime/growth-agent/latest.json';
const LEDGER = process.env.BETMAN_GROWTH_LEDGER || '/opt/betman/betman_hq/runtime/growth-agent/audit.jsonl';
const TIME_ZONE = process.env.BETMAN_GROWTH_TIME_ZONE || 'Pacific/Auckland';
const CONTROL = process.env.BETMAN_GROWTH_CONTROL || path.join(path.dirname(OUTPUT), 'control.json');
const EXECUTION_LEDGER = process.env.BETMAN_GROWTH_EXECUTION_LEDGER || path.join(path.dirname(OUTPUT), 'execution-audit.jsonl');

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

async function fetchCoreUsers(): Promise<CoreUser[]> {
  const baseUrl = (process.env.BETMAN_CORE_URL || '').replace(/\/$/, '');
  const token = process.env.BETMAN_HQ_AUTH_SUMMARY_TOKEN || '';
  if (!baseUrl || !token) throw new Error('Core auth summary is not configured');
  const summary = await fetchJson<CoreSummary>(`${baseUrl}/api/hq/auth-summary`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!summary.ok) throw new Error('Core auth summary returned ok=false');
  return summary.provisionedUsers || [];
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

async function requestedMode(): Promise<'watch' | 'live'> {
  try {
    const parsed = JSON.parse(await readFile(CONTROL, 'utf8')) as { mode?: string };
    return parsed.mode === 'live' ? 'live' : 'watch';
  } catch {
    return 'watch';
  }
}

async function hasSevenConsecutiveHealthyDays(): Promise<boolean> {
  try {
    const rows = (await readFile(LEDGER, 'utf8')).split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as GrowthSnapshot]; } catch { return []; }
    });
    const healthyDates = new Set(rows
      .filter((row) => row.health?.ok && ['meta', 'core', 'stripe'].every((source) => row.health.sources?.[source] === 'live'))
      .map((row) => dateInTimeZone(new Date(row.generatedAt), TIME_ZONE)));
    const ordered = [...healthyDates].sort();
    if (ordered.length < 7) return false;
    const recent = ordered.slice(-7).map((value) => Date.parse(`${value}T12:00:00Z`));
    return recent.every((value, index) => index === 0 || value - recent[index - 1] === 86_400_000);
  } catch {
    return false;
  }
}

function executionConfig(): GrowthExecutionConfig {
  return {
    token: process.env.META_ADS_WRITE_ACCESS_TOKEN || '',
    apiVersion: process.env.META_ADS_API_VERSION || 'v20.0',
    allowedCampaignIds: new Set((process.env.BETMAN_GROWTH_LIVE_CAMPAIGN_IDS || '').split(',').map((value) => value.trim()).filter(Boolean)),
    maximumPortfolioDailySpend: numberValue(process.env.BETMAN_GROWTH_LIVE_MAX_DAILY_SPEND),
    maximumBudgetChangePct: Math.min(20, numberValue(process.env.BETMAN_GROWTH_MAX_BUDGET_CHANGE_PCT || DEFAULT_GROWTH_GUARDRAILS.maximumBudgetChangePct)),
    minimumChangeIntervalHours: Math.max(48, numberValue(process.env.BETMAN_GROWTH_LIVE_CHANGE_INTERVAL_HOURS || 48)),
    ledgerFile: EXECUTION_LEDGER,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const window = lastCompleteSevenDays();
  const failures: string[] = [];
  const sources: Record<string, string> = {};
  let campaigns: CampaignPerformance[] = [];
  let unattributed = { commercialSignups: 0, trials: 0, paid: 0 };
  let attribution;
  let coreUsers: CoreUser[] = [];
  let paidEmails = new Set<string>();
  let paidCustomerIds = new Set<string>();

  try {
    campaigns = await fetchMetaCampaigns(window);
    sources.meta = 'live';
  } catch (error) {
    sources.meta = 'failed';
    failures.push(error instanceof Error ? error.message : 'Meta collection failed');
  }
  try {
    coreUsers = await fetchCoreUsers();
    sources.core = 'live';
  } catch (error) {
    sources.core = 'failed';
    failures.push(error instanceof Error ? error.message : 'Core collection failed');
  }
  try {
    const stripe = await fetchStripeSubscriberCounts();
    if (!stripe.isLive) throw new Error('Stripe is not configured');
    paidEmails = new Set(stripe.payingCustomerEmails.map((email) => email.trim().toLowerCase()));
    paidCustomerIds = new Set(stripe.payingCustomerIds.map((customerId) => customerId.trim()).filter(Boolean));
    sources.stripe = 'live';
  } catch (error) {
    sources.stripe = 'failed';
    failures.push(error instanceof Error ? error.message : 'Stripe collection failed');
  }

  if (sources.core === 'live') {
    const joined = attributeUserOutcomes(campaigns, coreUsers, window, paidEmails, paidCustomerIds);
    campaigns = joined.campaigns;
    unattributed = joined.unattributed;
    attribution = joined.coverage;
  }

  const decisions = decidePortfolio(campaigns, guardrailsFromEnvironment());
  const desiredMode = await requestedMode();
  const config = executionConfig();
  const blockers: string[] = [];
  if (process.env.BETMAN_GROWTH_EXECUTION_ENABLED !== 'true') blockers.push('Worker live execution kill switch is disabled');
  if (!config.token) blockers.push('Separate Meta ads_management identity not installed');
  if (config.token && config.token === process.env.META_ADS_ACCESS_TOKEN) blockers.push('Meta write identity must be separate from the read identity');
  if (!config.allowedCampaignIds.size) blockers.push('Live campaign allowlist is empty');
  if (!(config.maximumPortfolioDailySpend > 0)) blockers.push('Portfolio daily spend ceiling is not configured');
  if (!(await hasSevenConsecutiveHealthyDays())) blockers.push('Seven consecutive healthy collection days are not yet proven');
  const minimumAttributionPct = Math.max(0, numberValue(process.env.BETMAN_GROWTH_LIVE_MIN_ATTRIBUTION_PCT || 80));
  if (!attribution || attribution.signupMatchPct < minimumAttributionPct) blockers.push(`Exact signup attribution is below ${minimumAttributionPct}%`);
  if (failures.length) blockers.push('One or more live data sources are unhealthy');
  if (config.token && !blockers.some((value) => value.includes('separate from'))) {
    try {
      if (!(await verifyMetaWritePermission(config))) blockers.push('Meta write identity lacks ads_management permission');
    } catch {
      blockers.push('Meta write permission could not be verified');
    }
  }
  const liveReady = blockers.length === 0;
  const effectiveMode = desiredMode === 'live' && liveReady ? 'live' : 'watch';
  let actions: GrowthAutomationState['actions'] = decisions.map((decision) => ({
    campaignId: decision.campaignId,
    action: decision.action,
    status: decision.action === 'hold' ? 'resolved' as const : 'watching' as const,
    detail: decision.action === 'hold' ? 'No campaign change required.' : 'Observed in Watch mode; no campaign write performed.',
  }));
  if (effectiveMode === 'live') {
    actions = await executeGrowthActions(decisions, generatedAt, config);
    if (actions.some((action) => action.status === 'failed')) failures.push('One or more live campaign actions failed');
  }

  const snapshot: GrowthSnapshot = {
    schemaVersion: 1,
    generatedAt,
    mode: effectiveMode === 'live' ? 'execute' : 'dry-run',
    window,
    health: { ok: failures.length === 0, failures, sources },
    funnel: aggregateFunnel(campaigns, unattributed),
    attribution,
    campaigns,
    decisions,
    automation: {
      requestedMode: desiredMode,
      effectiveMode,
      liveReady,
      blockers,
      actions,
    },
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
