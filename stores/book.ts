import { useEffect, useMemo, useState } from 'react';

import { bookSymbols, trackedSymbols } from '@/lib/config';
import { useConfig } from '@/lib/config/provider';
import type { OhlcBar } from '@/lib/market';
import { buildPulseBook, type PulseBook } from '@/lib/pulse';

import { useDailyBook } from './daily';
import { GLANCE_CADENCE_MS, usePolledQuotes, useQuoteBook } from './quotes';

/**
 * Poll every tracked symbol's quotes while mounted. It lives in the drawer
 * layout, not in a screen, so the Pulse and the Board read one set of poll
 * loops instead of each running its own over the same ~90 symbols.
 */
export function useBookPolling(): void {
  const { config } = useConfig();
  const symbols = useMemo(() => trackedSymbols(config), [config]);
  usePolledQuotes(symbols, 'glance');
}

export interface BookView {
  symbols: string[];
  book: PulseBook;
  /** Daily bars per symbol, filling in as they arrive. */
  daily: Record<string, OhlcBar[] | undefined>;
  /** The clock the book was built against (epoch ms), ticking every 30s. */
  now: number;
}

/**
 * Which symbols a book covers: `book` is every grouped symbol (the Pulse, and
 * the Board by group), `tracked` adds thesis members in no group (the Board by
 * thesis), so the count can grow when the toggle flips, as on the web board.
 */
export type BookScope = 'book' | 'tracked';

/**
 * The book scored and ranked, for screens that read it. Quotes come from the
 * store `useBookPolling` fills; daily bars are the provider's cached fetches,
 * shared with every other screen.
 */
export function useBook(scope: BookScope = 'book'): BookView {
  const { config } = useConfig();
  const symbols = useMemo(
    () => (scope === 'tracked' ? trackedSymbols(config) : bookSymbols(config)),
    [config, scope]
  );
  const quotes = useQuoteBook(symbols);
  const daily = useDailyBook(symbols);

  // A clock tick, so time stamps and staleness advance without a quote having
  // to land. Being offline is exactly the case where none will.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const book = useMemo(
    () => buildPulseBook({ symbols, quotes, daily, cadenceMs: GLANCE_CADENCE_MS, now }),
    [symbols, quotes, daily, now]
  );

  return { symbols, book, daily, now };
}
