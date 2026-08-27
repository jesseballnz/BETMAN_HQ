import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const coreUrl = String(process.env.BETMAN_CORE_URL || '').replace(/\/$/, '');
  if (!coreUrl) {
    return NextResponse.json({ ok: false, error: 'core_not_configured' }, { status: 503 });
  }

  const response = await fetch(`${coreUrl}/api/password-setup-link`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({ ok: false, error: 'invalid_core_response' }));

  console.info('[BETMAN HQ] password reset link request', { email, ok: response.ok && payload?.ok === true });
  return NextResponse.json(payload, { status: response.status });
}
