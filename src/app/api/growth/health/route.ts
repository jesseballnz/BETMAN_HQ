import { NextResponse } from 'next/server';
import { readGrowthSnapshot } from '@/lib/growth/snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await readGrowthSnapshot();
  if (!snapshot) return NextResponse.json({ ok: false, error: 'snapshot_unavailable' }, { status: 503 });
  const ageSeconds = Math.max(0, (Date.now() - new Date(snapshot.generatedAt).getTime()) / 1000);
  const fresh = ageSeconds <= 6 * 60 * 60;
  return NextResponse.json({
    ok: snapshot.health.ok && fresh,
    mode: snapshot.mode,
    generatedAt: snapshot.generatedAt,
    ageSeconds: Math.round(ageSeconds),
    failures: snapshot.health.failures,
    sources: snapshot.health.sources,
  }, { status: snapshot.health.ok && fresh ? 200 : 503 });
}
