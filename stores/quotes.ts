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

/**
 * Poll quotes for a set of symbols on an interval while mounted, pushing each
 * into the store. Runs immediately, then every `intervalMs`.
 */
export function usePolledQuotes(symbols: string[], intervalMs = 30_000): void {
  const key = symbols.join(',');
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      const fetched = await market.getQuote(symbols).catch(() => [] as Quote[]);
      if (!cancelled) fetched.forEach(setQuote);
    };
    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // `key` captures the symbol set by value; `symbols` identity may vary per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs]);
}
