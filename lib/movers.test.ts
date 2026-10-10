import type { OhlcBar } from '@/lib/market';

import { MOVERS_PER_SIDE, rankMovers, windowBounds, windowPct, type WindowBounds } from './movers';

// The window cases are Fibenchi web's `board/window-returns.test.ts`, so a
// mover's % means the same on both.

const BOUNDS: WindowBounds = { start: '2026-07-27', latestBaseline: '2026-08-01' };

/** Daily bars stamped at noon UTC of each ISO date. */
const series = (...entries: [string, number][]): OhlcBar[] =>
  entries.map(([date, close]) => ({
    time: Date.parse(`${date}T12:00:00Z`) / 1000,
    open: close,
    high: close,
    low: close,
    close,
    adjClose: null,
    volume: null,
  }));

describe('windowPct', () => {
  it('measures from the last close at or before the window start', () => {
    const bars = series(['2026-07-24', 100], ['2026-07-27', 110], ['2026-08-20', 121]);
    expect(windowPct(bars, 121, BOUNDS)).toBeCloseTo(10);
  });

  it('takes the reopening session when the window starts on a closed day', () => {
    const bars = series(['2026-07-28', 100], ['2026-08-20', 105]);
    expect(windowPct(bars, 105, BOUNDS)).toBeCloseTo(5);
  });

  it('withholds when the series begins well after the window', () => {
    const bars = series(['2026-08-10', 100], ['2026-08-20', 130]);
    expect(windowPct(bars, 130, BOUNDS)).toBeNull();
  });

  it('measures against the live price, not the last stored close', () => {
    const bars = series(['2026-07-27', 100], ['2026-08-20', 110]);
    expect(windowPct(bars, 120, BOUNDS)).toBeCloseTo(20);
  });

  it('withholds on an empty series or a zero baseline', () => {
    expect(windowPct([], 100, BOUNDS)).toBeNull();
    expect(windowPct(series(['2026-07-27', 0], ['2026-08-20', 5]), 5, BOUNDS)).toBeNull();
  });
});

describe('windowBounds', () => {
  it('counts calendar days back from the local date, with five days of grace', () => {
    const now = new Date(2026, 7, 20, 15, 0).getTime(); // 2026-08-20 local
    expect(windowBounds('1wk', now)).toEqual({ start: '2026-08-13', latestBaseline: '2026-08-18' });
    expect(windowBounds('1mo', now).start).toBe('2026-07-21');
  });
});

describe('rankMovers', () => {
  const now = new Date(2026, 7, 20, 15, 0).getTime();
  const asset = (symbol: string, from: number, price: number | null = null) => ({
    symbol,
    bars: series(['2026-08-12', from], ['2026-08-19', 100]),
    price,
  });

  it('ranks up best-first and down worst-first, five each', () => {
    const assets = [
      ...[1, 2, 3, 4, 5, 6].map((n) => asset(`U${n}`, 100 - n)),
      ...[1, 2, 3, 4, 5, 6].map((n) => asset(`D${n}`, 100 + n)),
    ];
    const { up, down } = rankMovers(assets, '1wk', now);
    expect(up).toHaveLength(MOVERS_PER_SIDE);
    expect(down).toHaveLength(MOVERS_PER_SIDE);
    expect(up[0].symbol).toBe('U6');
    expect(down[0].symbol).toBe('D6');
    expect(up.every((m) => m.pct > 0) && down.every((m) => m.pct < 0)).toBe(true);
  });

  it('prefers the live price over the last close', () => {
    const { up } = rankMovers([asset('X', 100, 110)], '1wk', now);
    expect(up[0].pct).toBeCloseTo(10);
  });

  it('counts assets with no bars or no baseline as missing, never as flat', () => {
    const fresh = { symbol: 'NEW', bars: series(['2026-08-19', 50]), price: 60 };
    const loading = { symbol: 'LOAD', bars: undefined, price: 10 };
    const { up, down, missing } = rankMovers([fresh, loading, asset('X', 90)], '1wk', now);
    expect(missing).toBe(2);
    expect([...up, ...down].map((m) => m.symbol)).toEqual(['X']);
  });
});
