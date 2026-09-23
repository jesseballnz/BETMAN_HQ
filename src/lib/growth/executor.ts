import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GrowthDecision } from './types';

export interface GrowthExecutionConfig {
  token: string;
  apiVersion: string;
  allowedCampaignIds: Set<string>;
  maximumPortfolioDailySpend: number;
  maximumBudgetChangePct: number;
  minimumChangeIntervalHours: number;
  ledgerFile: string;
}

export interface GrowthActionResult {
  campaignId: string;
  action: GrowthDecision['action'];
  status: 'watching' | 'resolved' | 'executed' | 'blocked' | 'failed';
  detail: string;
  resolvedAt?: string;
}

interface MetaBudgetTarget { id: string; dailyBudget: number }
interface ExecutionRecord extends GrowthActionResult { actionId: string; generatedAt: string; previous?: unknown; next?: unknown }

async function graphJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Meta write API returned ${response.status}`);
  return body as T;
}

function graphUrl(config: GrowthExecutionConfig, object: string, params: Record<string, string>): string {
  const query = new URLSearchParams({ ...params, access_token: config.token });
  return `https://graph.facebook.com/${config.apiVersion}/${object}?${query}`;
}

export async function verifyMetaWritePermission(config: GrowthExecutionConfig): Promise<boolean> {
  if (!config.token) return false;
  const body = await graphJson<{ data?: Array<{ permission?: string; status?: string }> }>(
    graphUrl(config, 'me/permissions', {}),
  );
  return (body.data || []).some((row) => row.permission === 'ads_management' && row.status === 'granted');
}

async function campaignBudgetTargets(config: GrowthExecutionConfig, campaignId: string): Promise<MetaBudgetTarget[]> {
  const campaign = await graphJson<{ id?: string; daily_budget?: string }>(
    graphUrl(config, campaignId, { fields: 'id,daily_budget' }),
  );
  const campaignBudget = Number(campaign.daily_budget || 0);
  if (Number.isFinite(campaignBudget) && campaignBudget > 0) return [{ id: campaignId, dailyBudget: campaignBudget }];

  const adsets = await graphJson<{ data?: Array<{ id?: string; daily_budget?: string; status?: string }> }>(
    graphUrl(config, `${campaignId}/adsets`, { fields: 'id,daily_budget,status', limit: '100' }),
  );
  return (adsets.data || [])
    .map((row) => ({ id: String(row.id || ''), dailyBudget: Number(row.daily_budget || 0) }))
    .filter((row) => row.id && Number.isFinite(row.dailyBudget) && row.dailyBudget > 0);
}

async function mutate(config: GrowthExecutionConfig, objectId: string, fields: Record<string, string>): Promise<void> {
  await graphJson(graphUrl(config, objectId, {}), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
}

async function readLedger(file: string): Promise<ExecutionRecord[]> {
  try {
    return (await readFile(file, 'utf8')).split('\n').filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as ExecutionRecord]; } catch { return []; }
    });
  } catch {
    return [];
  }
}

async function appendRecord(file: string, record: ExecutionRecord): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, { mode: 0o640 });
}

function actionId(generatedAt: string, decision: GrowthDecision): string {
  return `${generatedAt}:${decision.campaignId}:${decision.action}:${decision.budgetChangePct}`;
}

export async function executeGrowthActions(
  decisions: GrowthDecision[],
  generatedAt: string,
  config: GrowthExecutionConfig,
  now = new Date(),
): Promise<GrowthActionResult[]> {
  const records = await readLedger(config.ledgerFile);
  const results: GrowthActionResult[] = [];
  let portfolioBudgetMinor = 0;
  const portfolioTargets = new Map<string, MetaBudgetTarget[]>();
  for (const campaignId of config.allowedCampaignIds) {
    const targets = await campaignBudgetTargets(config, campaignId);
    portfolioTargets.set(campaignId, targets);
    portfolioBudgetMinor += targets.reduce((sum, target) => sum + target.dailyBudget, 0);
  }

  for (const decision of decisions) {
    if (decision.action === 'hold') {
      results.push({ campaignId: decision.campaignId, action: decision.action, status: 'resolved', detail: 'No campaign change required.', resolvedAt: now.toISOString() });
      continue;
    }
    if (!config.allowedCampaignIds.has(decision.campaignId)) {
      results.push({ campaignId: decision.campaignId, action: decision.action, status: 'blocked', detail: 'Campaign is not on the live allowlist.' });
      continue;
    }
    const id = actionId(generatedAt, decision);
    if (records.some((record) => record.actionId === id && record.status === 'executed')) {
      results.push({ campaignId: decision.campaignId, action: decision.action, status: 'resolved', detail: 'Identical action was already executed.', resolvedAt: now.toISOString() });
      continue;
    }
    const last = [...records].reverse().find((record) => record.campaignId === decision.campaignId && record.status === 'executed');
    if (last?.resolvedAt && now.getTime() - new Date(last.resolvedAt).getTime() < config.minimumChangeIntervalHours * 3600_000) {
      results.push({ campaignId: decision.campaignId, action: decision.action, status: 'blocked', detail: `Campaign changed within the last ${config.minimumChangeIntervalHours} hours.` });
      continue;
    }

    const record: ExecutionRecord = { actionId: id, generatedAt, campaignId: decision.campaignId, action: decision.action, status: 'failed', detail: 'Execution did not complete.' };
    try {
      if (decision.action === 'pause') {
        record.previous = { status: 'ACTIVE' };
        record.next = { status: 'PAUSED' };
        await mutate(config, decision.campaignId, { status: 'PAUSED' });
      } else {
        const pct = Math.min(Math.abs(decision.budgetChangePct), config.maximumBudgetChangePct);
        if (!(pct > 0)) throw new Error('Budget change percentage is invalid');
        const targets = portfolioTargets.get(decision.campaignId) || [];
        if (!targets.length) throw new Error('No daily campaign or ad-set budget is available');
        const factor = decision.action === 'scale' ? 1 + pct / 100 : 1 - pct / 100;
        const nextTargets = targets.map((target) => ({ ...target, nextDailyBudget: Math.max(100, Math.round(target.dailyBudget * factor)) }));
        const nextPortfolioMinor = portfolioBudgetMinor - targets.reduce((sum, target) => sum + target.dailyBudget, 0)
          + nextTargets.reduce((sum, target) => sum + target.nextDailyBudget, 0);
        if (nextPortfolioMinor / 100 > config.maximumPortfolioDailySpend) throw new Error('Portfolio daily spend ceiling would be exceeded');
        record.previous = targets;
        record.next = nextTargets;
        const changed: typeof nextTargets = [];
        try {
          for (const target of nextTargets) {
            await mutate(config, target.id, { daily_budget: String(target.nextDailyBudget) });
            changed.push(target);
          }
        } catch (error) {
          for (const target of changed.reverse()) {
            const previous = targets.find((row) => row.id === target.id);
            if (previous) await mutate(config, target.id, { daily_budget: String(previous.dailyBudget) }).catch(() => undefined);
          }
          throw error;
        }
        portfolioBudgetMinor = nextPortfolioMinor;
      }
      record.status = 'executed';
      record.detail = decision.action === 'pause' ? 'Campaign paused through Meta.' : `Daily budget ${decision.action === 'scale' ? 'increased' : 'reduced'} by ${Math.min(Math.abs(decision.budgetChangePct), config.maximumBudgetChangePct)}%.`;
      record.resolvedAt = now.toISOString();
    } catch (error) {
      record.status = 'failed';
      record.detail = error instanceof Error ? error.message : 'Execution failed';
    }
    await appendRecord(config.ledgerFile, record);
    results.push({ campaignId: record.campaignId, action: record.action, status: record.status, detail: record.detail, resolvedAt: record.resolvedAt });
    if (record.status === 'failed') break;
  }
  return results;
}
