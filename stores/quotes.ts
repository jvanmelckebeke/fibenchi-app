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

// Adaptive cadence: fast while a tracked symbol's session is live (pre/regular/
// post), slow when everything is closed. Off-hours prices barely move, so there's
// no point hammering Yahoo or spinning the radio every 5s overnight.
const LIVE_INTERVAL_MS = 5_000;
const IDLE_INTERVAL_MS = 60_000;

/**
 * Poll quotes for a set of symbols while mounted, pushing each into the store.
 * Runs immediately, then re-schedules off the latest market state — ~5s during
 * an open session, ~60s once all tracked symbols are closed. Stops on unmount,
 * which is what makes polling track "while this screen is active".
 */
export function usePolledQuotes(symbols: string[]): void {
  const key = symbols.join(',');
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const fetched = await market.getQuote(symbols).catch(() => [] as Quote[]);
      if (cancelled) return;
      fetched.forEach(setQuote);
      const live = fetched.some((quote) => quote.marketState !== 'closed');
      timer = setTimeout(() => void tick(), live ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // `key` captures the symbol set by value; `symbols` identity may vary per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
