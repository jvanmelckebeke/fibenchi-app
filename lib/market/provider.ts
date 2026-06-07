import { TtlCache } from './cache';
import type { IntradayResult, OhlcBar, Period, Quote } from './types';
import { fetchYahooJson } from './yahoo/client';
import { chartPath, dailyRange } from './yahoo/endpoints';
import { parseBars, parseIntraday, parseQuote } from './yahoo/parse';

const QUOTE_TTL_MS = 15_000;
const INTRADAY_TTL_MS = 60_000;
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

  async getQuote(symbols: string[]): Promise<Quote[]> {
    const quotes = await Promise.all(symbols.map((symbol) => this.quoteOne(symbol).catch(() => null)));
    return quotes.filter((quote): quote is Quote => quote !== null);
  }

  private quoteOne(symbol: string): Promise<Quote> {
    return this.cache.remember(`quote:${symbol}`, QUOTE_TTL_MS, async () => {
      const json = await fetchYahooJson(
        chartPath(symbol, { interval: '1m', range: '1d', includePrePost: true })
      );
      return parseQuote(json);
    });
  }

  getIntraday(symbol: string): Promise<IntradayResult> {
    return this.cache.remember(`intraday:${symbol}`, INTRADAY_TTL_MS, async () => {
      const json = await fetchYahooJson(
        chartPath(symbol, { interval: '1m', range: '1d', includePrePost: true })
      );
      return parseIntraday(json);
    });
  }

  getDaily(symbol: string, period: Period): Promise<OhlcBar[]> {
    return this.cache.remember(`daily:${symbol}:${period}`, DAILY_TTL_MS, async () => {
      const json = await fetchYahooJson(chartPath(symbol, { interval: '1d', range: dailyRange(period) }));
      return parseBars(json);
    });
  }
}
