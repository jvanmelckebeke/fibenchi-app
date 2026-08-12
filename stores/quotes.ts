import { useEffect, useSyncExternalStore } from 'react';

import { market, type Quote } from '@/lib/market';

// Per-symbol quote store: a tick for one symbol re-renders only that symbol's
// card, not the whole list (the RN analog of Fibenchi's SSE per-symbol store).

/**
 * What we know about one symbol's live data. The distinction that matters is
 * `quote === undefined && misses === 0` (never fetched — still loading) versus
 * `quote === undefined && misses > 0` (asked and got nothing). Yahoo drops
 * symbols it stops answering for, and rendering both as an em dash makes a
 * symbol that has gone quiet look identical to one that is still arriving.
 */
export interface QuoteState {
  quote: Quote | undefined;
  /** When `quote` was last replaced (epoch ms), or null if never. */
  updatedAt: number | null;
  /** Consecutive polls that returned nothing since the last good value. */
  misses: number;
}

const EMPTY: QuoteState = { quote: undefined, updatedAt: null, misses: 0 };

const states = new Map<string, QuoteState>();
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

function update(symbol: string, next: QuoteState): void {
  states.set(symbol, next);
  listeners.get(symbol)?.forEach((listener) => listener());
}

function recordQuote(quote: Quote): void {
  update(quote.symbol, { quote, updatedAt: Date.now(), misses: 0 });
}

function recordMiss(symbol: string): void {
  const current = states.get(symbol) ?? EMPTY;
  update(symbol, { ...current, misses: current.misses + 1 });
}

/** Subscribe to one symbol's latest quote (undefined until first fetch). */
export function useQuote(symbol: string): Quote | undefined {
  return useQuoteState(symbol).quote;
}

/**
 * Subscribe to one symbol's full live state — for UI that has to tell "loading"
 * apart from "this symbol stopped reporting", or show how old a value is.
 */
export function useQuoteState(symbol: string): QuoteState {
  return useSyncExternalStore(
    (listener) => subscribe(symbol, listener),
    () => states.get(symbol) ?? EMPTY
  );
}

/**
 * Poll cadence by what the screen is for. 5s is right for a detail chart being
 * watched; on a glance screen it is indistinguishable from 20s and costs 4x the
 * requests across the whole book.
 */
export type Cadence = 'detail' | 'glance';

const LIVE_INTERVAL_MS: Record<Cadence, number> = {
  detail: 5_000,
  glance: 20_000,
};

/**
 * Fallback re-check for a symbol whose venue is closed and whose next bell we
 * don't know (no `currentTradingPeriod`, or a window already in the past). Long,
 * because a closed market's number does not change.
 */
const CLOSED_RECHECK_MS = 10 * 60_000;
/** Cap on sleeping to the bell, so a stale window can't park a loop for a day. */
const MAX_SLEEP_MS = 30 * 60_000;
/** A miss is transport, not a market state — retry sooner than a closed venue. */
const MISS_RETRY_MS = 30_000;

/**
 * How long until this symbol is worth asking about again. Exported for its own
 * test — the request policy is the part of this screen worth pinning.
 *
 * Polling a closed venue buys nothing: its number is fixed until the next bell,
 * so the loop sleeps toward `regularWindow.start` (capped, and re-checked on
 * wake) instead of re-asking on a fixed interval. Pre/post count as closed for
 * cadence — `isOpen` is the per-symbol signal, already localised per exchange by
 * Yahoo, so a mixed EU/US book keeps the EU names live while the US ones idle.
 */
export function nextPollDelay(quote: Quote | undefined, cadence: Cadence): number {
  if (!quote) return MISS_RETRY_MS;
  if (quote.isOpen) return LIVE_INTERVAL_MS[cadence];

  const start = quote.regularWindow?.start;
  if (start === undefined) return CLOSED_RECHECK_MS;
  const untilBell = start * 1000 - Date.now();
  if (untilBell <= 0) return CLOSED_RECHECK_MS;
  // Land just after the bell, and jitter so the whole book doesn't wake in lockstep.
  return Math.min(untilBell + 1_000 + Math.random() * 2_000, MAX_SLEEP_MS);
}

/**
 * Poll quotes for a set of symbols while mounted, pushing each into the store.
 * Each symbol runs its own loop, re-scheduling off its own market state (see
 * `nextPollDelay`). Stops on unmount, which is what makes polling track "while this
 * screen is active". There's no batch quote endpoint — `getQuote([s])` is one
 * fetch per symbol either way — so independent loops cost no extra requests;
 * they just let each symbol keep its own clock. Concurrency is capped in the
 * Yahoo client, so a 44-symbol cold open queues rather than opening 44 sockets.
 */
export function usePolledQuotes(symbols: string[], cadence: Cadence = 'glance'): void {
  const key = symbols.join(',');
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const tick = async (symbol: string) => {
      const [quote] = await market.getQuote([symbol]).catch(() => [] as Quote[]);
      if (cancelled) return;
      if (quote) recordQuote(quote);
      else recordMiss(symbol);
      timers.set(
        symbol,
        setTimeout(() => void tick(symbol), nextPollDelay(quote, cadence))
      );
    };

    symbols.forEach((symbol) => void tick(symbol));
    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
    // `key` captures the symbol set by value; `symbols` identity may vary per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cadence]);
}
