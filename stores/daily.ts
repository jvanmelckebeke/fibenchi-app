import { useEffect, useMemo, useState } from 'react';

import { indicatorHistoryPeriod } from '@/lib/compute';
import { market, type OhlcBar } from '@/lib/market';

// Daily bars for a whole book of symbols, which is what σ-Move needs and what
// `TickerCard` already pulls per row. These are the *same* cached fetches — the
// provider's 1h TTL means a card mount and the Pulse share one request per symbol
// per hour — so the cost of this store is bookkeeping, not bandwidth. Request
// concurrency is capped in the Yahoo client, so a 44-symbol cold open queues
// rather than opening 44 sockets at once.

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
export function useDailyBook(symbols: string[]): Record<string, OhlcBar[] | undefined> {
  const key = symbols.join(',');
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const missing = symbols.filter((symbol) => !bars.has(symbol) || isStale(symbol, now));
    if (missing.length === 0) return;

    const period = indicatorHistoryPeriod();
    void Promise.all(
      missing.map(async (symbol) => {
        const series = await market.getDaily(symbol, period).catch(() => null);
        if (cancelled || !series || series.length === 0) return;
        bars.set(symbol, series);
        fetchedAt.set(symbol, Date.now());
        // One re-render per arrival: the screen shows five of ~44 rows, so a
        // book that fills in progressively settles rather than popping in at once.
        setLoaded((n) => n + 1);
      })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    const book: Record<string, OhlcBar[] | undefined> = {};
    for (const symbol of symbols) book[symbol] = bars.get(symbol);
    return book;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded]);
}
