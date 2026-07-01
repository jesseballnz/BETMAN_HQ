// Server-side client for aggregate BETMAN Core account metrics.

function getCoreBaseUrl(): string {
  return (process.env.BETMAN_CORE_URL ?? '').replace(/\/$/, '');
}

function getAuthSummaryToken(): string {
  return process.env.BETMAN_HQ_AUTH_SUMMARY_TOKEN ?? '';
}

export function isBetmanCoreAuthSummaryConfigured(): boolean {
  return Boolean(getCoreBaseUrl() && getAuthSummaryToken());
}

export interface CoreAuthSummary {
  ok: boolean;
  source: 'core-auth-state';
  fetchedAt: string;
  uniqueAccounts: number;
  activeAccounts: number;
  passwordPendingAccounts: number;
  apiKeysActive: number;
  planCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

export async function fetchCoreAuthSummary(): Promise<CoreAuthSummary | null> {
  if (!isBetmanCoreAuthSummaryConfigured()) return null;

  const res = await fetch(`${getCoreBaseUrl()}/api/hq/auth-summary`, {
    headers: {
      Authorization: `Bearer ${getAuthSummaryToken()}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BETMAN Core auth summary -> ${res.status}: ${text}`);
  }

  const body = (await res.json()) as CoreAuthSummary;
  return body.ok ? body : null;
}
