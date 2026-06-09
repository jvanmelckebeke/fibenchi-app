import { useEffect, useSyncExternalStore } from 'react';

import { market, type Quote } from '@/lib/market';

// Per-symbol quote store: a tick for one symbol re-renders only that symbol's
// card, not the whole list (the RN analog of Fibenchi's SSE per-symbol store).

const quotes = new Map<string, Quote>();
const listeners = new Map<string, Set<() => void>>();

function subscribe(symbol: string, listener: () => void): () => void {
  let set = listeners.get(symbol);
  if (!set) {
    set = new Set();
    listeners.set(symbol, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}

function setQuote(quote: Quote): void {
  quotes.set(quote.symbol, quote);
  listeners.get(quote.symbol)?.forEach((listener) => listener());
}

/** Subscribe to one symbol's latest quote (undefined until first fetch). */
export function useQuote(symbol: string): Quote | undefined {
  return useSyncExternalStore(
    (listener) => subscribe(symbol, listener),
    () => quotes.get(symbol)
  );
}

// Per-symbol adaptive cadence: a symbol polls fast while *its own* market is open
// (so a mixed EU/US group keeps the EU names live at ~5s while the closed US ones
// idle at ~60s), and backs off once closed. There's no batch quote endpoint —
// getQuote([s]) is one fetch per symbol either way — so independent loops cost no
// extra requests; they just let each symbol keep its own clock.
const LIVE_INTERVAL_MS = 5_000;
const IDLE_INTERVAL_MS = 60_000;

/**
 * Poll quotes for a set of symbols while mounted, pushing each into the store.
 * Each symbol runs its own loop, re-scheduling off its latest `isOpen` — ~5s
 * while open (regular session, or always for crypto), ~60s otherwise. Stops on
 * unmount, which is what makes polling track "while this screen is active".
 */
export function usePolledQuotes(symbols: string[]): void {
  const key = symbols.join(',');
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const tick = async (symbol: string) => {
      const [quote] = await market.getQuote([symbol]).catch(() => [] as Quote[]);
      if (cancelled) return;
      if (quote) setQuote(quote);
      // No quote (fetch failed / dropped) → back off like a closed market.
      const delay = quote?.isOpen ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
      timers.set(symbol, setTimeout(() => void tick(symbol), delay));
    };

    symbols.forEach((symbol) => void tick(symbol));
    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
    // `key` captures the symbol set by value; `symbols` identity may vary per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
