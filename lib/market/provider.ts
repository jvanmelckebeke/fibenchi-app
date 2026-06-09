import { TtlCache } from './cache';
import type { IntradayResult, OhlcBar, Period, Quote } from './types';
import { fetchYahooJson } from './yahoo/client';
import { chartPath, dailyRange } from './yahoo/endpoints';
import { parseBars, parseIntraday, parseQuote } from './yahoo/parse';

// The live quote and today's intraday are parsed from the *same* 1m/1d chart
// response, so they share one cached fetch per symbol rather than hitting Yahoo
// twice (a 15-ticker group would otherwise fire ~2x the requests on open).
const CHART_1D_TTL_MS = 15_000;
const DAILY_TTL_MS = 60 * 60_000; // 1 hour — daily bars only change once per session

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
}

/**
 * Yahoo Finance via the crumb-free v8 chart endpoint. (The v7 quote endpoint
 * needs a crumb/cookie handshake that is fragile and often blocked; the chart
 * endpoint needs neither and carries the same fields in `meta`.)
 */
export class YahooProvider extends PriceProvider {
  private cache = new TtlCache();

  /** Cached raw 1m/1d chart JSON — shared by getQuote + getIntraday. */
  private chart1d(symbol: string): Promise<unknown> {
    return this.cache.remember(`chart1d:${symbol}`, CHART_1D_TTL_MS, () =>
      fetchYahooJson(chartPath(symbol, { interval: '1m', range: '1d', includePrePost: true }))
    );
  }

  async getQuote(symbols: string[]): Promise<Quote[]> {
    const quotes = await Promise.all(
      symbols.map((symbol) => this.chart1d(symbol).then(parseQuote).catch(() => null))
    );
    return quotes.filter((quote): quote is Quote => quote !== null);
  }

  getIntraday(symbol: string): Promise<IntradayResult> {
    return this.chart1d(symbol).then(parseIntraday);
  }

  getDaily(symbol: string, period: Period): Promise<OhlcBar[]> {
    return this.cache.remember(`daily:${symbol}:${period}`, DAILY_TTL_MS, async () => {
      const json = await fetchYahooJson(chartPath(symbol, { interval: '1d', range: dailyRange(period) }));
      return parseBars(json);
    });
  }
}
