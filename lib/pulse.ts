import { sigmaMove, type SigmaMove } from '@/lib/compute';
import { sessionTime } from '@/lib/date';
import type { OhlcBar, Quote } from '@/lib/market';
import type { QuoteState } from '@/stores/quotes';

// The Pulse's whole-book arithmetic, kept pure so it can be reasoned about (and
// tested) without a screen: rank by |σ|, count breadth over what is *currently
// trading*, and say why anything unscored has no reading.
//
// Principle 4 from the spec governs every book-level figure here: at 09:47 CET
// Hong Kong's number is today's final close, New York's is yesterday's, and
// Europe's is 47 minutes old. An average or a count over all three is a number
// about nothing, so every aggregate is scoped to the venues that are open now.

/** How many σ rows the screen shows. Fixed, so the headline is free to vary. */
export const PULSE_ROWS = 5;

export interface PulseAsset {
  symbol: string;
  quote: Quote | undefined;
  /** null while the daily bars are still loading. */
  sigma: SigmaMove | null;
  /** |σ| for ranking; null when there's no reading. */
  rank: number | null;
  /** Signed σ, for the chip and the tail bar. */
  score: number | null;
  /**
   * Price and day % **on the same basis as the σ beside them**. While the venue
   * trades that's the live quote; otherwise it's the last completed session's
   * close and its own move — not the extended-hours print, which would put a
   * pre-market % next to yesterday's σ on one row.
   */
  price: number | null;
  changePct: number | null;
  /** Venue trading right now *and* we have a quote for it. */
  live: boolean;
  /**
   * What the number represents, when it isn't a live session: `yesterday's
   * close`, `closed 17:30`. Null while trading — the row's dot and price already
   * say everything a stamp could.
   */
  stamp: string | null;
  /** Why there's no σ, in the screen's own words. Null when scored or loading. */
  unscored: string | null;
  misses: number;
  updatedAt: number | null;
}

export interface PulseBreadth {
  up: number;
  down: number;
  /** Assets with a known day move on a venue that is open right now. */
  live: number;
}

export interface PulseBook {
  /** The `PULSE_ROWS` most extreme σ-moves, |σ| desc, ties by symbol. */
  top: PulseAsset[];
  /** Scored assets past the cut — the tail strip, one bar each. */
  tail: PulseAsset[];
  /** Everything with no reading, for the coverage panel. */
  unscored: PulseAsset[];
  breadth: PulseBreadth;
  scored: number;
  total: number;
  /** Newest quote timestamp across the book (epoch ms), or null. */
  lastGoodAt: number | null;
  /**
   * Set when nothing has landed for ~2x the cadence *while venues are open* —
   * i.e. our numbers are frozen, not the market. Null when the quiet is simply
   * that nothing is trading.
   */
  offlineFor: number | null;
}

export interface PulseInput {
  symbols: string[];
  quotes: Record<string, QuoteState | undefined>;
  daily: Record<string, OhlcBar[] | undefined>;
  cadenceMs: number;
  now: number;
}

/** Epoch seconds → whole UTC days, matching the daily bars' own stamps. */
const utcDay = (seconds: number) => Math.floor(seconds / 86_400);

/**
 * The day's return as a fraction, from the live quote — what σ-Move scores when
 * the session's own daily bar hasn't been written yet.
 */
function dayReturn(quote: Quote | undefined): number | null {
  if (!quote || quote.previousClose === 0) return null;
  return quote.price / quote.previousClose - 1;
}

/**
 * What this number *is*, when it isn't a live session. The venue name is
 * deliberately omitted — the dot already says "closed" and the ticker suffix
 * carries the venue; what's missing is *when*.
 */
function stampFor(quote: Quote | undefined, bar: OhlcBar | undefined, now: number): string | null {
  if (!quote || quote.isOpen) return null;
  // Which session the number is from is a question about the *bar*, not the
  // clock: a bar dated today means today's session has already run and closed.
  const ranToday = bar !== undefined && utcDay(bar.time) === utcDay(Math.floor(now / 1000));
  const end = quote.regularWindow?.end;
  if (ranToday) return end !== undefined ? `closed ${sessionTime(end)}` : 'closed';
  return "yesterday's close";
}

/** Why this asset has no σ — the taxonomy the coverage panel lists. */
function unscoredReason(state: QuoteState | undefined, sigma: SigmaMove | null): string | null {
  // A symbol Yahoo has stopped answering for must not read like one still
  // loading: that's the whole point of tracking misses in the store.
  if (state && !state.quote && state.misses > 0) {
    const since = state.updatedAt ? ` since ${sessionTime(state.updatedAt / 1000)}` : '';
    return `no quote${since} · ${state.misses} ${state.misses === 1 ? 'poll' : 'polls'} missed`;
  }
  if (!sigma) return null; // daily bars still in flight
  if (sigma.kind === 'gap') return `${sigma.sessions}-session gap in the daily series`;
  if (sigma.kind === 'warmup') {
    return `building baseline · ${sigma.returns} of ${sigma.needed} bars`;
  }
  return null;
}

function asset(symbol: string, input: PulseInput): PulseAsset {
  const state = input.quotes[symbol];
  const quote = state?.quote;
  const bars = input.daily[symbol];
  const live = quote
    ? {
        dayReturn: dayReturn(quote),
        sessionOpen: quote.isOpen,
        asOf: quote.marketTime || Math.floor(input.now / 1000),
      }
    : null;
  const sigma = bars && bars.length >= 2 ? sigmaMove(bars, live) : null;
  const scored = sigma?.kind === 'scored' ? sigma.sigma : null;
  const onLiveBasis = sigma?.kind === 'scored' && sigma.basis === 'live';

  // The bar the σ is about — the row's price and % come from the same place, so
  // the two halves of a row can't be about different sessions.
  const scoredBar = sigma?.kind === 'scored' ? bars?.[sigma.barIndex] : undefined;
  const priorBar = sigma?.kind === 'scored' ? bars?.[sigma.barIndex - 1] : undefined;

  return {
    symbol,
    quote,
    sigma,
    rank: scored === null ? null : Math.abs(scored),
    score: scored,
    price: onLiveBasis ? (quote?.price ?? null) : (scoredBar?.close ?? quote?.price ?? null),
    changePct: onLiveBasis
      ? (quote?.changePercent ?? null)
      : (barChangePct(scoredBar, priorBar) ?? quote?.changePercent ?? null),
    live: quote?.isOpen === true,
    stamp: stampFor(quote, scoredBar ?? bars?.[bars.length - 1], input.now),
    unscored: unscoredReason(state, sigma),
    misses: state?.misses ?? 0,
    updatedAt: state?.updatedAt ?? null,
  };
}

/** A completed session's own move, for rows whose venue isn't trading. */
function barChangePct(bar: OhlcBar | undefined, prior: OhlcBar | undefined): number | null {
  if (!bar || !prior || prior.close === 0) return null;
  return (bar.close / prior.close - 1) * 100;
}

/**
 * Whether the *phone* is the thing that's stale. Offline is a screen-level state
 * here, not a per-row one: the backend loses a symbol or two, but the phone loses
 * the whole book at once. Quiet with nothing open is not staleness — that's just
 * a closed market, and claiming otherwise would be the same lie as a pinging dot
 * on frozen data.
 */
function offlineFor(
  assets: PulseAsset[],
  lastGoodAt: number | null,
  input: PulseInput
): number | null {
  if (!assets.some((a) => a.live)) return null; // nothing is trading — quiet is correct
  if (lastGoodAt === null) return null; // nothing has ever landed — still starting up
  const age = input.now - lastGoodAt;
  return age > input.cadenceMs * 2 ? age : null;
}

/** Newest quote across the book — the age the whole screen is stamped with. */
function newestUpdate(assets: PulseAsset[]): number | null {
  return assets.reduce<number | null>(
    (newest, a) =>
      a.updatedAt !== null && (newest === null || a.updatedAt > newest) ? a.updatedAt : newest,
    null
  );
}

export function buildPulseBook(input: PulseInput): PulseBook {
  const assets = input.symbols.map((symbol) => asset(symbol, input));

  const ranked = assets
    .filter((a) => a.rank !== null)
    .sort((a, b) => b.rank! - a.rank! || a.symbol.localeCompare(b.symbol));

  // Breadth over the live set only, per principle 4. `COCO.MI` with a % but no σ
  // counts; a symbol Yahoo returned nothing for does not.
  const liveWithMove = assets.filter((a) => a.live && a.changePct !== null);
  const breadth: PulseBreadth = {
    up: liveWithMove.filter((a) => a.changePct! > 0).length,
    down: liveWithMove.filter((a) => a.changePct! < 0).length,
    live: liveWithMove.length,
  };

  const lastGoodAt = newestUpdate(assets);

  return {
    top: ranked.slice(0, PULSE_ROWS),
    tail: ranked.slice(PULSE_ROWS),
    unscored: assets.filter((a) => a.unscored !== null),
    breadth,
    scored: ranked.length,
    total: input.symbols.length,
    lastGoodAt,
    offlineFor: offlineFor(assets, lastGoodAt, input),
  };
}
