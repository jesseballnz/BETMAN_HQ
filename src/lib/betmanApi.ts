/**
 * BETMAN_DATA API client
 *
 * Typed wrapper for the BETMAN_DATA platform API.
 * Base URL:  BETMAN_API_URL  (e.g. https://data-api.betman.internal/v1)
 * Auth:      Authorization: ******
 *
 * All fetches are server-side only — the API key is never exposed to the browser.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return (process.env.BETMAN_API_URL ?? '').replace(/\/$/, '');
}

function getApiKey(): string {
  return process.env.BETMAN_API_KEY ?? '';
}

export function isBetmanApiConfigured(): boolean {
  return Boolean(process.env.BETMAN_API_URL && process.env.BETMAN_API_KEY);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function betmanFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const authHeader: Record<string, string> = {};
  const apiKey = getApiKey();
  if (apiKey) {
    authHeader['Authorization'] = ['Bearer', apiKey].join(' ');
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeader,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    // Don't cache — HQ always wants fresh data
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BETMAN API ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface BetmanHealth {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
}

export interface BetmanStatsOverview {
  database: {
    name: string;
    total_size_bytes: number;
    table_count: number;
  };
  counts: {
    meetings: number;
    races: number;
    runners: number;
    entries: number;
    odds_snapshots: number;
    meetings_today: number;
    races_today: number;
    runners_today: number;
  };
  freshness: {
    latest_odds_snapshot: string | null;
    latest_weather_reading: string | null;
    latest_media_segment: string | null;
    latest_meeting_date: string | null;
  };
  ingestion_last_24h: {
    odds_snapshots_24h: number;
    weather_readings_24h: number;
    media_segments_24h: number;
  };
}

export interface BetmanMeeting {
  id: number;
  track_name: string;
  meeting_date: string;
  surface: string;
  jurisdiction: string;
  races?: BetmanRaceSummary[];
}

export interface BetmanRaceSummary {
  id: number;
  race_number: number;
  name: string;
  scheduled_start_time: string;
  status: 'scheduled' | 'running' | 'finished';
  race_class_code: string;
}

export interface BetmanTenant {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  license_type: string;
  license_expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface BetmanUsageItem {
  tenant_id: number;
  tenant_slug: string;
  day: string;
  requests: number;
  error_requests: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** GET /health */
export async function fetchBetmanHealth(): Promise<BetmanHealth> {
  return betmanFetch<BetmanHealth>('/health');
}

/** GET /stats/overview */
export async function fetchBetmanStats(): Promise<BetmanStatsOverview> {
  return betmanFetch<BetmanStatsOverview>('/stats/overview');
}

/** GET /meetings?date=YYYY-MM-DD */
export async function fetchTodaysMeetings(): Promise<BetmanMeeting[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await betmanFetch<{ meetings: BetmanMeeting[] }>(`/meetings?date=${today}`);
  return res.meetings ?? [];
}

/** GET /admin/tenants */
export async function fetchTenants(): Promise<BetmanTenant[]> {
  const res = await betmanFetch<{ tenants: BetmanTenant[] }>('/admin/tenants');
  return res.tenants ?? [];
}

/** GET /admin/usage?days=N */
export async function fetchUsageSummary(days = 7): Promise<BetmanUsageItem[]> {
  const res = await betmanFetch<{ items: BetmanUsageItem[] }>(`/admin/usage?days=${days}`);
  return res.items ?? [];
}
