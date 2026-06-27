import { NextResponse } from 'next/server';
import { fetchBetmanStats, isBetmanApiConfigured } from '@/lib/betmanApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isBetmanApiConfigured()) {
    return NextResponse.json(null);
  }
  try {
    const stats = await fetchBetmanStats();
    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
