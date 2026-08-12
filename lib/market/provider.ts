import { TtlCache } from './cache';
import type { IntradayResult, OhlcBar, Period, Quote, SymbolSearchResult } from './types';
import { fetchYahooJson } from './yahoo/client';
import { chartPath, dailyRange, searchPath } from './yahoo/endpoints';
import { parseBars, parseIntraday, parseQuote, parseSearchResults } from './yahoo/parse';

// A quote is read from `meta` alone — price, previousClose, day high/low, volume,
// currency, currentTradingPeriod. So quotes poll `interval=1d&range=1d` (~1.2 KB)
// rather than the 1m series (~4 KB for a US session, ~40 KB for crypto's 24h),
// which is the same crumb-free endpoint and the same `meta` block: a poll that
// downloads a full minute series to read its header off is the app's single
// largest avoidable cost. The 1m fetch stays for the sparkline and the detail
// chart, where the series is actually used.
//
// `interval=1d` omits `meta.previousClose` and carries only `chartPreviousClose`;
// `parseQuote` already falls back between them, and the two agree across an open
// EU session, a closed/pre US one, and crypto.
//
// Both TTLs must stay *below* the live poll cadence (see stores/quotes.ts) —
// otherwise a live poll is served a stale cached quote and the price stops
// ticking. They only need to absorb the mount-time burst (a card's getIntraday
// and its first quote firing near-simultaneously), which the in-flight de-dup
// already mostly covers.
const QUOTE_TTL_MS = 4_000;
const CHART_1D_TTL_MS = 4_000;
const DAILY_TTL_MS = 60 * 60_000; // 1 hour — daily bars only change once per session
const SEARCH_TTL_MS = 5 * 60_000; // 5 min — a query's matches are stable within a session

/**
 * The swap-point for the market-data source. Keeps the public surface small:
 * what's tracked (config) is decided elsewhere; this only answers "what's the
 * price / shape / history" for a given symbol.
 */
export abstract class PriceProvider {
  /** Latest quote per symbol (failed symbols are dropped, not thrown). */
  abstract getQuote(symbols: string[]): Promise<Quote[]>;
  /** Today's intraday trajectory for the sparkline / day chart. */
  abstract getIntraday(symbol: string): Promise<IntradayResult>;
  /** Daily OHLC bars over a period, for indicators + movement. */
  abstract getDaily(symbol: string, period: Period): Promise<OhlcBar[]>;
  /** Symbol search (equity/ETF/index) — for the lookup screen. */
  abstract searchSymbols(query: string): Promise<SymbolSearchResult[]>;
}

/**
 * Yahoo Finance via the crumb-free v8 chart endpoint. (The v7 quote endpoint
 * needs a crumb/cookie handshake that is fragile and often blocked; the chart
 * endpoint needs neither and carries the same fields in `meta`.)
 */
export class YahooProvider extends PriceProvider {
  private cache = new TtlCache();

  /** Cached raw 1m/1d chart JSON — the minute series, for sparklines/detail. */
  private chart1d(symbol: string): Promise<unknown> {
    return this.cache.remember(`chart1d:${symbol}`, CHART_1D_TTL_MS, () =>
      fetchYahooJson(chartPath(symbol, { interval: '1m', range: '1d', includePrePost: true }))
    );
  }

  /** Cached meta-only chart JSON — the quote poll's payload. */
  private quoteChart(symbol: string): Promise<unknown> {
    return this.cache.remember(`quote:${symbol}`, QUOTE_TTL_MS, () =>
      fetchYahooJson(chartPath(symbol, { interval: '1d', range: '1d' }))
    );
  }

  async getQuote(symbols: string[]): Promise<Quote[]> {
    const quotes = await Promise.all(
      symbols.map((symbol) =>
        this.quoteChart(symbol)
          .then(parseQuote)
          .catch(() => null)
      )
    );
    return quotes.filter((quote): quote is Quote => quote !== null);
  }

  getIntraday(symbol: string): Promise<IntradayResult> {
    return this.chart1d(symbol).then(parseIntraday);
  }

  getDaily(symbol: string, period: Period): Promise<OhlcBar[]> {
    return this.cache.remember(`daily:${symbol}:${period}`, DAILY_TTL_MS, async () => {
      const json = await fetchYahooJson(
        chartPath(symbol, { interval: '1d', range: dailyRange(period) })
      );
      return parseBars(json);
    });
  }

  searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const q = query.trim();
    if (q.length === 0) return Promise.resolve([]);
    return this.cache.remember(`search:${q.toLowerCase()}`, SEARCH_TTL_MS, async () => {
      const json = await fetchYahooJson(searchPath(q));
      return parseSearchResults(json);
    });
  }
}
