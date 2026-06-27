import { NextResponse } from 'next/server';
import { fetchBetmanHealth, isBetmanApiConfigured } from '@/lib/betmanApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isBetmanApiConfigured()) {
    return NextResponse.json({ status: 'unconfigured', version: null, timestamp: null });
  }
  try {
    const health = await fetchBetmanHealth();
    return NextResponse.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ status: 'error', message }, { status: 502 });
  }
}
