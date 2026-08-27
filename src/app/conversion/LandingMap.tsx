'use client';

import { useState } from 'react';
import { APAC_MARKET_CENTRES, projectApacPoint } from '@/lib/geoProjection';
import type { ConversionTrafficCity, ConversionTrafficGeography } from '@/lib/hqConversion';
import { fmtNumber } from '@/lib/calculations';

interface MarketMetric {
  countryCode: string;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
}

interface LandingMapProps {
  rows: ConversionTrafficGeography[];
  cities: ConversionTrafficCity[];
  resolution?: {
    cityResolvedSessions?: number;
    totalSessions?: number;
  };
  marketMetrics: MarketMetric[];
}

function fmtCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function countryCode(value: string): string {
  return value.toUpperCase();
}

export default function LandingMap({ rows, cities, resolution, marketMetrics }: LandingMapProps) {
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const countryRows = new Map(rows.map((row) => [countryCode(row.countryCode), row]));
  const landingViewsByCountry = new Map<string, { landingPageViews: number }>();

  for (const row of marketMetrics) {
    const code = countryCode(row.countryCode);
    const current = landingViewsByCountry.get(code) ?? { landingPageViews: 0 };
    current.landingPageViews += row.landingPageViews;
    landingViewsByCountry.set(code, current);
  }

  const marketTotal = (code: string) => (
    landingViewsByCountry.get(code)?.landingPageViews ||
    countryRows.get(code)?.landingSessions ||
    0
  );
  const totalSessions = rows.reduce((sum, row) => sum + row.landingSessions, 0);
  const visibleMarketTotal = APAC_MARKET_CENTRES.reduce(
    (sum, market) => sum + (countryRows.get(market.code)?.landingSessions ?? 0),
    0,
  );
  const otherMarkets = rows.filter(
    (row) => !APAC_MARKET_CENTRES.some((market) => market.code === countryCode(row.countryCode)),
  );
  const totalMarketViews = Array.from(landingViewsByCountry.values())
    .reduce((sum, row) => sum + row.landingPageViews, 0) || totalSessions;
  const maxMarketTotal = Math.max(1, ...APAC_MARKET_CENTRES.map((market) => marketTotal(market.code)));
  const projectableCities = cities
    .map((city) => ({ city, point: projectApacPoint(city) }))
    .filter((item): item is { city: ConversionTrafficCity; point: { x: number; y: number } } => item.point !== null);
  const maxCitySessions = Math.max(1, ...projectableCities.map(({ city }) => city.landingSessions));
  const selected = selectedMarket === 'ALL'
    ? null
    : APAC_MARKET_CENTRES.find((market) => market.code === selectedMarket);
  const datasetCities = cities
    .filter((city) => !selected || countryCode(city.countryCode) === selected.code)
    .sort((a, b) => b.landingSessions - a.landingSessions);
  const datasetSessions = datasetCities.reduce((sum, city) => sum + city.landingSessions, 0);
  const selectedMetrics = marketMetrics.filter((row) => !selected || countryCode(row.countryCode) === selected.code);
  const metricCurrencies = Array.from(new Set(selectedMetrics.filter((row) => row.spend > 0).map((row) => row.currency)));
  const metricCurrency = metricCurrencies[0] || 'NZD';
  const metricTotals = selectedMetrics.reduce((sum, row) => ({
    spend: sum.spend + row.spend,
    impressions: sum.impressions + row.impressions,
    reach: sum.reach + row.reach,
    clicks: sum.clicks + row.clicks,
    landingPageViews: sum.landingPageViews + row.landingPageViews,
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, landingPageViews: 0 });
  const cityResolvedSessions = resolution?.cityResolvedSessions ?? cities.reduce((sum, city) => sum + city.landingSessions, 0);
  const resolutionTotal = resolution?.totalSessions ?? totalSessions;
  const cityResolutionPct = resolutionTotal > 0 ? (cityResolvedSessions / resolutionTotal) * 100 : 0;

  return (
    <section id="landing-map" className="mb-8 scroll-mt-20 overflow-hidden rounded-xl border border-slate-800 bg-gray-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Landing Sessions by Market</h2>
            <p className="mt-1 text-xs text-slate-500">
              City and country are resolved locally from connection IPs. HQ receives aggregate location counts only.
            </p>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={() => setSelectedMarket('ALL')}
              className="text-2xl font-black tabular-nums text-white underline decoration-slate-700 underline-offset-4 hover:text-cyan-300"
              aria-label="View all landing session locations"
            >
              {fmtNumber(totalSessions)}
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">identified sessions</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="relative h-[380px] overflow-hidden rounded-xl border border-slate-700/70 bg-[#06111f] shadow-inner sm:h-[460px] lg:h-[520px] xl:h-[560px] xl:self-start">
          <div className="absolute left-4 top-4 z-10 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 backdrop-blur">
            Asia-Pacific focus
          </div>
          <svg
            viewBox="0 0 900 520"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Map showing landing sessions in New Zealand, Australia and Hong Kong"
          >
            <defs>
              <filter id="glow"><feGaussianBlur stdDeviation="7" /></filter>
            </defs>
            <image href="/apac-map.svg" x="0" y="0" width="900" height="520" preserveAspectRatio="none" />
            {APAC_MARKET_CENTRES.map((market) => {
              const point = projectApacPoint(market);
              if (!point) return null;
              const total = marketTotal(market.code);
              const hasMetaViews = (landingViewsByCountry.get(market.code)?.landingPageViews ?? 0) > 0;
              const radius = 18 + 18 * Math.sqrt(total / maxMarketTotal);
              return (
                <g
                  key={market.code}
                  transform={`translate(${point.x} ${point.y})`}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer outline-none"
                  onClick={() => setSelectedMarket(market.code)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedMarket(market.code);
                  }}
                  aria-label={`View full ${market.name} dataset`}
                >
                  <circle r={radius + 11} fill={market.colour} opacity=".12" filter="url(#glow)" />
                  <circle r={radius + 7} fill={market.colour} opacity=".14" />
                  <circle r={radius} fill="#071522" stroke={market.colour} strokeWidth="4" />
                  <text y="-2" textAnchor="middle" fill="#f8fafc" fontSize="18" fontWeight="900">{fmtNumber(total)}</text>
                  <text y="16" textAnchor="middle" fill={market.colour} fontSize="10" fontWeight="800" letterSpacing="1.5">{market.short}</text>
                  <title>{market.name}: {fmtNumber(total)} {hasMetaViews ? 'Meta landing-page views' : 'owned attributed sessions'} - click for full dataset</title>
                </g>
              );
            })}
            {projectableCities.map(({ city, point }) => {
              const radius = 4 + 7 * Math.sqrt(city.landingSessions / maxCitySessions);
              return (
                <g key={`${city.countryCode}-${city.region}-${city.city}`} transform={`translate(${point.x} ${point.y})`} data-testid="landing-city-dot">
                  <circle r={radius + 4} fill="#f8fafc" opacity=".12" />
                  <circle r={radius} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" opacity=".92" />
                  <title>{city.city}{city.region ? `, ${city.region}` : ''}, {city.country}: {fmtNumber(city.landingSessions)} sessions</title>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
            {APAC_MARKET_CENTRES.map((market) => {
              const ownedSessions = countryRows.get(market.code)?.landingSessions ?? 0;
              const total = marketTotal(market.code);
              const hasMetaViews = (landingViewsByCountry.get(market.code)?.landingPageViews ?? 0) > 0;
              const share = totalMarketViews > 0 ? (total / totalMarketViews) * 100 : 0;
              const topCities = cities.filter((city) => countryCode(city.countryCode) === market.code).slice(0, 5);
              return (
                <div key={market.code} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md px-2 py-1 text-[10px] font-black tracking-wider text-slate-950" style={{ backgroundColor: market.colour }}>
                      {market.short}
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500">{share.toFixed(1)}%</span>
                  </div>
                  <p className="mt-3 truncate text-xs font-semibold text-slate-400">{market.name}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {hasMetaViews ? 'Meta landing-page views' : 'Owned attributed sessions'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedMarket(market.code)}
                    className="mt-0.5 text-2xl font-black tabular-nums text-white underline decoration-cyan-700 underline-offset-4 hover:text-cyan-300"
                    aria-label={`View full ${market.name} dataset`}
                  >
                    {fmtNumber(total)}
                  </button>
                  {hasMetaViews && ownedSessions > 0 && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      {fmtNumber(ownedSessions)} owned attributed session{ownedSessions === 1 ? '' : 's'}
                    </p>
                  )}
                  <div className="mt-3 border-t border-slate-800 pt-2">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600">Top landing cities</p>
                    {topCities.length > 0 ? topCities.map((city) => (
                      <div key={`${city.region}-${city.city}`} className="flex items-center justify-between gap-2 py-1 text-[11px]">
                        <span className="truncate text-slate-400" title={city.region ? `${city.city}, ${city.region}` : city.city}>{city.city}</span>
                        <span className="font-bold tabular-nums text-slate-200">{fmtNumber(city.landingSessions)}</span>
                      </div>
                    )) : (
                      <p className="py-1 text-[11px] text-slate-600">No city-resolved sessions yet</p>
                    )}
                    <button type="button" onClick={() => setSelectedMarket(market.code)} className="mt-2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300">
                      View full dataset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Core-market reach</span>
              <span className="font-bold tabular-nums text-cyan-300">{totalSessions ? (visibleMarketTotal / totalSessions * 100).toFixed(1) : '0.0'}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{fmtNumber(visibleMarketTotal)} sessions across NZ, Australia and Hong Kong</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">City resolution</span>
              <span className="font-bold tabular-nums text-white">{cityResolutionPct.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, cityResolutionPct)}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {fmtNumber(cityResolvedSessions)} of {fmtNumber(resolutionTotal)} sessions resolved to a city using the local GeoIP database.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSelectedMarket('ALL')}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/45 p-4 text-left hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            aria-label="View every area that recorded landing traffic"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Areas clocked</span>
              <span className="mt-1 block text-xs text-slate-600">Open the full area dataset</span>
            </span>
            <span className="font-black tabular-nums text-white">{fmtNumber(cities.length)}</span>
          </button>

          {otherMarkets.length > 0 && (
            <details className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400">Other markets ({otherMarkets.length})</summary>
              <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {otherMarkets.map((row) => (
                  <div key={row.countryCode} className="flex items-center justify-between rounded-md bg-slate-900 px-2.5 py-2">
                    <span className="text-xs text-slate-400">{row.country}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-300">{fmtNumber(row.landingSessions)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {!rows.length && (
            <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
              Country estimates will appear after the next log aggregation.
            </p>
          )}
        </div>
      </div>

      {selectedMarket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="market-dataset-title"
          onClick={() => setSelectedMarket(null)}
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <h3 id="market-dataset-title" className="text-xl font-black text-white">{selected?.name || 'All Markets'} - Full Area Dataset</h3>
                <p className="mt-1 text-xs text-slate-500">30-day aggregate location and Meta delivery data. No raw IP addresses are exposed.</p>
              </div>
              <button type="button" onClick={() => setSelectedMarket(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-bold text-slate-300 hover:bg-slate-800" aria-label="Close market dataset">
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b border-slate-800 p-5 sm:grid-cols-4 lg:grid-cols-7">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Sessions</p><p className="text-xl font-black text-white">{fmtNumber(datasetSessions)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Areas</p><p className="text-xl font-black text-white">{fmtNumber(datasetCities.length)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Impressions</p><p className="text-xl font-black text-white">{fmtNumber(metricTotals.impressions)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Reach</p><p className="text-xl font-black text-white">{fmtNumber(metricTotals.reach)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Clicks</p><p className="text-xl font-black text-white">{fmtNumber(metricTotals.clicks)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Meta LPV</p><p className="text-xl font-black text-white">{fmtNumber(metricTotals.landingPageViews)}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Spend</p><p className="text-xl font-black text-white">{metricCurrencies.length <= 1 ? fmtCurrency(metricTotals.spend, metricCurrency) : 'Mixed'}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">CPC</p><p className="text-xl font-black text-white">{metricCurrencies.length <= 1 && metricTotals.clicks > 0 ? fmtCurrency(metricTotals.spend / metricTotals.clicks, metricCurrency) : '-'}</p></div>
            </div>
            <div className="max-h-[58vh] overflow-auto p-5">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="sticky top-0 bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Country</th>
                    <th className="px-3 py-2 text-left">Area</th>
                    <th className="px-3 py-2 text-left">Region</th>
                    <th className="px-3 py-2 text-right">Sessions</th>
                    <th className="px-3 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {datasetCities.map((city) => (
                    <tr key={`${city.countryCode}-${city.region}-${city.city}`} className="border-t border-slate-800">
                      <td className="px-3 py-2.5 text-slate-400">{city.country}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-200">{city.city}</td>
                      <td className="px-3 py-2.5 text-slate-500">{city.region || '-'}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-white">{fmtNumber(city.landingSessions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{datasetSessions > 0 ? `${(city.landingSessions / datasetSessions * 100).toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                  {!datasetCities.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No city-resolved sessions in this market.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
