import { useEffect, useMemo } from 'react';

import { indicatorHistoryPeriod } from '@/lib/compute';
import { fetchPulse, pulseBars } from '@/lib/config/pulse';
import { market, type OhlcBar } from '@/lib/market';

import { bumpBook } from './revision';

// Daily bars for a whole book of symbols, which is what σ-Move and the window
// returns need. Fibenchi's pulse bundle supplies the book in one request: 40
// days of closes per symbol, with the server's σ inputs primed into the σ
// cache. Symbols the bundle lacks, or every symbol when Fibenchi doesn't answer,
// come from Yahoo as before: the provider's cached 6mo fetches, which a card
// mount shares, behind the client's concurrency cap.

const bars = new Map<string, OhlcBar[]>();
const fetchedAt = new Map<string, number>();

/**
 * Matches the provider's daily TTL. Holding bars in this map for the life of the
 * app would otherwise outlive the cache behind it: a phone left open across a
 * session close would keep scoring σ off yesterday's last bar.
 */
const STALE_MS = 60 * 60_000;

const isStale = (symbol: string, now: number) => now - (fetchedAt.get(symbol) ?? 0) > STALE_MS;

/**
 * Daily bars per symbol, filling in as they arrive. Symbols already fetched are
 * served from the module map, so navigating back to the screen doesn't re-fetch
 * or re-flash an empty book.
 */
export function useDailyBook(
  symbols: string[],
  revision: number,
  endpoint: string | null
): Record<string, OhlcBar[] | undefined> {
  const key = symbols.join(',');

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const missing = symbols.filter((symbol) => !bars.has(symbol) || isStale(symbol, now));
    if (missing.length === 0) return;

    const period = indicatorHistoryPeriod();
    const store = (symbol: string, series: OhlcBar[]) => {
      bars.set(symbol, series);
      fetchedAt.set(symbol, Date.now());
      // Through the book revision, so arrivals fold into its throttled rebuilds.
      bumpBook();
    };

    void (async () => {
      // One request to Fibenchi covers the book; Yahoo only fills what it lacks.
      const pulse = await fetchPulse(endpoint);
      if (cancelled) return;
      const rest: string[] = [];
      for (const symbol of missing) {
        const entry = pulse?.symbols[symbol];
        const series = entry ? pulseBars(entry) : null;
        if (series) store(symbol, series);
        else rest.push(symbol);
      }
      await Promise.all(
        rest.map(async (symbol) => {
          const series = await market.getDaily(symbol, period).catch(() => null);
          if (cancelled || !series || series.length === 0) return;
          store(symbol, series);
        })
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, endpoint]);

  return useMemo(() => {
    const book: Record<string, OhlcBar[] | undefined> = {};
    for (const symbol of symbols) book[symbol] = bars.get(symbol);
    return book;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);
}
