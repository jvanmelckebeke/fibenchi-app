import type { OhlcBar } from '@/lib/market';

// The Movers panel: % over a calendar window, top five each way. Ported from
// Fibenchi web's `board/window-returns.ts` and `MoversCard` in `board/rail.tsx`,
// so "+8.2% over 2 weeks" means the same thing on the phone as on the laptop.
//
// The windows are calendar days back from the local date, not trading days.
// The baseline is the last close on or before the window's start; when the
// start lands in a closure (a weekend, a holiday run) the first close after it
// counts, within a bounded grace. A series that begins further in than that
// (an asset added recently) has no baseline, which is the honest answer.

export type MoverWindow = '1wk' | '2wk' | '1mo';

export const MOVER_WINDOWS: { value: MoverWindow; label: string; days: number }[] = [
  { value: '1wk', label: '1wk', days: 7 },
  { value: '2wk', label: '2wk', days: 14 },
  { value: '1mo', label: '1mo', days: 30 },
];

/** Rows per side, as on the web rail. */
export const MOVERS_PER_SIDE = 5;

/** The longest run of closed sessions a window can open on. */
const BASELINE_GRACE_DAYS = 5;

export interface WindowBounds {
  /** ISO date the window opens on. */
  start: string;
  /** Latest ISO date a close may carry and still serve as the baseline. */
  latestBaseline: string;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Local date `days` before `now`, as ISO — web's `relativeStart`. */
function relativeStart(days: number, now: number): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return isoDate(d);
}

export function windowBounds(window: MoverWindow, now: number): WindowBounds {
  const days = MOVER_WINDOWS.find((w) => w.value === window)!.days;
  return {
    start: relativeStart(days, now),
    latestBaseline: relativeStart(days - BASELINE_GRACE_DAYS, now),
  };
}

/** A daily bar's session date. Daily bar stamps line up with UTC dates. */
const barDate = (bar: OhlcBar) => new Date(bar.time * 1000).toISOString().slice(0, 10);

/**
 * Percent change from the window's baseline close to `last`, or null when the
 * series has no close the window can start from. `bars` ascend by time.
 */
export function windowPct(bars: OhlcBar[], last: number, bounds: WindowBounds): number | null {
  if (bars.length === 0) return null;

  let base: OhlcBar | null = null;
  for (const bar of bars) {
    if (barDate(bar) <= bounds.start) base = bar;
    else break;
  }
  if (!base && barDate(bars[0]) <= bounds.latestBaseline) base = bars[0];

  if (!base || base.close === 0) return null;
  return ((last - base.close) / base.close) * 100;
}

export interface Mover {
  symbol: string;
  pct: number;
}

export interface Movers {
  up: Mover[];
  down: Mover[];
  /** Symbols with no reading for this window (no bars yet, or no baseline). */
  missing: number;
}

export interface MoverInput {
  symbol: string;
  bars: OhlcBar[] | undefined;
  /** The live price when there is one; the last close stands in otherwise. */
  price: number | null;
}

export function rankMovers(assets: MoverInput[], window: MoverWindow, now: number): Movers {
  const bounds = windowBounds(window, now);
  const ranked: Mover[] = [];
  for (const { symbol, bars, price } of assets) {
    if (!bars || bars.length === 0) continue;
    const last = price ?? bars[bars.length - 1].close;
    const pct = windowPct(bars, last, bounds);
    if (pct !== null) ranked.push({ symbol, pct });
  }
  ranked.sort((a, b) => b.pct - a.pct || a.symbol.localeCompare(b.symbol));
  return {
    up: ranked.filter((m) => m.pct > 0).slice(0, MOVERS_PER_SIDE),
    down: ranked
      .filter((m) => m.pct < 0)
      .slice(-MOVERS_PER_SIDE)
      .reverse(),
    missing: assets.length - ranked.length,
  };
}
