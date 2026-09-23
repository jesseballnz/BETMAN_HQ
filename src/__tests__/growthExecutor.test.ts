import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { executeGrowthActions, verifyMetaWritePermission, type GrowthExecutionConfig } from '@/lib/growth/executor';
import type { GrowthDecision } from '@/lib/growth/types';

const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

async function config(overrides: Partial<GrowthExecutionConfig> = {}): Promise<GrowthExecutionConfig> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'growth-executor-'));
  return {
    token: 'write-token',
    apiVersion: 'v20.0',
    allowedCampaignIds: new Set(['campaign-1']),
    maximumPortfolioDailySpend: 100,
    maximumBudgetChangePct: 20,
    minimumChangeIntervalHours: 48,
    ledgerFile: path.join(directory, 'audit.jsonl'),
    ...overrides,
  };
}

const decision = (action: GrowthDecision['action'], budgetChangePct = 0): GrowthDecision => ({
  campaignId: 'campaign-1',
  campaign: 'Campaign 1',
  action,
  budgetChangePct,
  reason: 'test',
  evidence: { spend: 10, landingPageViews: 10, trials: 0, paid: 0, costPerLanding: 1, costPerTrial: null, paidCac: null },
});

describe('Growth live executor', () => {
  afterEach(() => jest.restoreAllMocks());

  test('requires granted ads_management permission', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ data: [{ permission: 'ads_read', status: 'granted' }] }));
    await expect(verifyMetaWritePermission(await config())).resolves.toBe(false);
  });

  test('pauses an allowlisted campaign and records resolution', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ id: 'campaign-1', daily_budget: '1000' }))
      .mockResolvedValueOnce(response({ success: true }));
    const result = await executeGrowthActions([decision('pause')], '2026-09-23T00:00:00.000Z', await config(), new Date('2026-09-23T00:01:00.000Z'));
    expect(result).toEqual([expect.objectContaining({ status: 'executed', action: 'pause' })]);
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST', body: new URLSearchParams({ status: 'PAUSED' }) }));
  });

  test('reduces a daily budget within the hard percentage cap', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response({ id: 'campaign-1', daily_budget: '1000' }))
      .mockResolvedValueOnce(response({ success: true }));
    const result = await executeGrowthActions([decision('reduce', -40)], '2026-09-23T00:00:00.000Z', await config(), new Date('2026-09-23T00:01:00.000Z'));
    expect(result[0]).toEqual(expect.objectContaining({ status: 'executed', detail: 'Daily budget reduced by 20%.' }));
    expect(String((fetchMock.mock.calls[1][1]?.body as URLSearchParams).get('daily_budget'))).toBe('800');
  });

  test('blocks an unallowlisted mutation without a Meta write', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ id: 'campaign-1', daily_budget: '1000' }));
    const item = decision('pause');
    item.campaignId = 'campaign-2';
    const result = await executeGrowthActions([item], '2026-09-23T00:00:00.000Z', await config());
    expect(result[0]).toEqual(expect.objectContaining({ status: 'blocked' }));
  });

  test('fails closed when scaling would exceed the portfolio ceiling', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(response({ id: 'campaign-1', daily_budget: '1000' }));
    const result = await executeGrowthActions([decision('scale', 20)], '2026-09-23T00:00:00.000Z', await config({ maximumPortfolioDailySpend: 11 }));
    expect(result[0]).toEqual(expect.objectContaining({ status: 'failed', detail: 'Portfolio daily spend ceiling would be exceeded' }));
  });
});
