import { NextResponse } from 'next/server';
import { fetchUsageSummary, fetchTenants, isBetmanApiConfigured } from '@/lib/betmanApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isBetmanApiConfigured()) {
    return NextResponse.json({ tenants: [], usage: [] });
  }
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') ?? '7', 10);

  try {
    const [tenants, usage] = await Promise.all([
      fetchTenants(),
      fetchUsageSummary(days),
    ]);
    return NextResponse.json({ tenants, usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
