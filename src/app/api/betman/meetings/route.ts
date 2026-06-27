import { NextResponse } from 'next/server';
import { fetchTodaysMeetings, isBetmanApiConfigured } from '@/lib/betmanApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isBetmanApiConfigured()) {
    return NextResponse.json([]);
  }
  try {
    const meetings = await fetchTodaysMeetings();
    return NextResponse.json(meetings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
