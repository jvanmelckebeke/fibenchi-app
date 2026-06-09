import type { Period } from '../types';

/** Yahoo serves identical data from query1/query2 — we fail over between them. */
export const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'] as const;

export interface ChartOptions {
  interval: string;
  range: string;
  includePrePost?: boolean;
}

/**
 * The v8 chart endpoint needs no crumb/cookie (unlike v7/quote, which 401s),
 * which makes it the reliable path from a mobile client. A single call yields
 * both the live quote (via `meta`) and the bar series.
 *
 * Query string is built by hand to avoid relying on a URLSearchParams polyfill
 * under Hermes.
 */
export function chartPath(symbol: string, opts: ChartOptions): string {
  const includePrePost = opts.includePrePost ?? false;
  const query = `interval=${opts.interval}&range=${opts.range}&includePrePost=${includePrePost}`;
  return `/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`;
}

/** Daily-bar range for a requested period (interval is always `1d`). */
export function dailyRange(period: Period): string {
  return period;
}

/**
 * The v1 search endpoint — crumb-free like the chart endpoint, so it rides the
 * same `fetchYahooJson` path. We only want symbol matches, not news. Query
 * string hand-built (no URLSearchParams under Hermes).
 */
export function searchPath(query: string, count = 8): string {
  const q = `q=${encodeURIComponent(query)}&quotesCount=${count}&newsCount=0&listsCount=0`;
  return `/v1/finance/search?${q}`;
}
