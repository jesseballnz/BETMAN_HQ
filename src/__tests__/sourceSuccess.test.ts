import { buildSourceSuccessSummary } from '@/lib/sourceSuccess';

describe('buildSourceSuccessSummary', () => {
  test('groups owned landing traffic by source platform', () => {
    const summary = buildSourceSuccessSummary([
      { platform: 'facebook', campaign: 'a', landingSessions: 51, signups: 0, trials: 0, verifiedTrials: 0, conversions: 0 },
      { platform: 'facebook', campaign: 'b', landingSessions: 119, signups: 2, trials: 1, verifiedTrials: 1, conversions: 0 },
      { platform: 'instagram', campaign: 'a', landingSessions: 18, signups: 0, trials: 0, verifiedTrials: 0, conversions: 0 },
      { platform: 'meta', campaign: 'unassigned', landingSessions: 15, signups: 0, trials: 0, verifiedTrials: 0, conversions: 0 },
    ]);

    expect(summary.landingSessions).toBe(203);
    expect(summary.campaigns).toBe(4);
    expect(summary.rows).toEqual([
      {
        platform: 'facebook',
        landingSessions: 170,
        signups: 2,
        trials: 1,
        verifiedTrials: 1,
        conversions: 0,
        campaigns: 2,
        sharePct: expect.closeTo(83.744, 3),
      },
      {
        platform: 'instagram',
        landingSessions: 18,
        signups: 0,
        trials: 0,
        verifiedTrials: 0,
        conversions: 0,
        campaigns: 1,
        sharePct: expect.closeTo(8.867, 3),
      },
      {
        platform: 'meta',
        landingSessions: 15,
        signups: 0,
        trials: 0,
        verifiedTrials: 0,
        conversions: 0,
        campaigns: 1,
        sharePct: expect.closeTo(7.389, 3),
      },
    ]);
  });
});
