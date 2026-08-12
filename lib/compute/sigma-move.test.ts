import type { OhlcBar } from '@/lib/market';

import {
  SIGMA_MOVE_WARMUP,
  computeIndicators,
  getMaxWarmup,
  indicatorHistoryPeriod,
  sigmaMove,
} from './indicators';
import { sessionGapDays, volatilityNormalizedReturn } from './series-math';

// The golden vectors (indicators.test.ts) pin σ-Move's EWMA against the pandas
// reference on a contiguous series. What they can't cover is the gap guard: the
// fixture has a RangeIndex, so the backend reports no gap information there.
// These tests cover the app-side fallback and the live-scoring path the Pulse
// ranks on.

const DAY = 86_400;
/** Mon 2026-06-01 00:00 UTC — so weekday arithmetic in the tests is readable. */
const MONDAY = 1_780_272_000;

const bar = (time: number, close: number): OhlcBar => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
  adjClose: null,
  volume: null,
});

/** `count` sessions starting on a Monday, skipping weekends. */
function sessions(count: number, close: (i: number) => number): OhlcBar[] {
  const bars: OhlcBar[] = [];
  let day = 0;
  for (let i = 0; i < count; i++) {
    const weekday = (day + 0) % 7;
    if (weekday === 5 || weekday === 6) {
      day += weekday === 5 ? 2 : 1;
      i--;
      continue;
    }
    bars.push(bar(MONDAY + day * DAY, close(bars.length)));
    day++;
  }
  return bars;
}

describe('history budget', () => {
  it('does not widen the daily fetch — σ-Move at warmup 60 still resolves to 6mo', () => {
    // 60 is now the registry max (was SMA-50's 50); the helper fetches ~2x, so
    // 120 bars are needed and 6mo (~126) still covers it. If this ever trips,
    // every TickerCard mount starts pulling a year of history.
    expect(getMaxWarmup()).toBe(SIGMA_MOVE_WARMUP);
    expect(indicatorHistoryPeriod()).toBe('6mo');
  });
});

describe('sessionGapDays', () => {
  it('reads consecutive weekday sessions as adjacent', () => {
    const gaps = sessionGapDays(sessions(10, (i) => 100 + i).map((b) => b.time));
    expect(gaps[0]).toBeNull(); // first bar carries no gap information
    expect(gaps.slice(1).every((g) => g === 1)).toBe(true);
  });

  it('does not treat a weekend as a hole', () => {
    // Fri → Mon: business days in [Fri, Mon) is 1, the same as any other step.
    const friday = MONDAY + 4 * DAY;
    expect(sessionGapDays([friday, friday + 3 * DAY])[1]).toBe(1);
  });

  it('counts a missing session as a gap', () => {
    // Mon → Wed with no Tuesday bar.
    expect(sessionGapDays([MONDAY, MONDAY + 2 * DAY])[1]).toBe(2);
  });

  it('reads every calendar day as adjacent, so crypto never trips the guard', () => {
    const times = Array.from({ length: 10 }, (_, i) => MONDAY + i * DAY);
    expect(
      sessionGapDays(times)
        .slice(1)
        .every((g) => g !== null && g <= 1)
    ).toBe(true);
  });
});

describe('volatilityNormalizedReturn gap guard', () => {
  const closes = Array.from({ length: 8 }, (_, i) => 100 + i);

  it('suppresses a gap-spanning bar and reports its width', () => {
    const gaps = [null, 1, 1, 3, 1, 1, 1, 1];
    const { vnr, vnrGapSessions } = volatilityNormalizedReturn(closes, 0.94, gaps);
    expect(vnr[3]).toBeNull();
    expect(vnrGapSessions[3]).toBe(3);
    expect(vnr[4]).not.toBeNull();
    expect(vnrGapSessions[4]).toBeNull();
  });

  it('keeps the gap-spanning return out of the variance', () => {
    // Same series, but the bar after the hole is a large move. With the hole
    // masked, its forecast is built only from the clean returns before it.
    const spiky = [...closes.slice(0, 3), 130, 131, 132, 133, 134];
    const guarded = volatilityNormalizedReturn(spiky, 0.94, [null, 1, 1, 3, 1, 1, 1, 1]);
    const unguarded = volatilityNormalizedReturn(spiky, 0.94);
    // Unguarded, the 30% jump inflates the forecast and shrinks every later σ.
    expect(Math.abs(guarded.vnr[5]!)).toBeGreaterThan(Math.abs(unguarded.vnr[5]!));
  });
});

describe('sigmaMove', () => {
  /** A settled series: enough sessions to clear warmup, alternating moves. */
  const settled = sessions(SIGMA_MOVE_WARMUP + 20, (i) => 100 + (i % 2 === 0 ? 0 : 1.5));

  it('reports warmup progress before the baseline is built', () => {
    const result = sigmaMove(sessions(30, (i) => 100 + (i % 2 === 0 ? 0 : 1)));
    expect(result).toEqual({ kind: 'warmup', returns: 29, needed: SIGMA_MOVE_WARMUP });
  });

  it('scores the last completed bar when there is no live return', () => {
    const result = sigmaMove(settled);
    expect(result.kind).toBe('scored');
    if (result.kind !== 'scored') return;
    expect(result.basis).toBe('close');
    const { fields } = computeIndicators(settled);
    expect(result.sigma).toBeCloseTo(fields.vnr[settled.length - 1]!, 12);
  });

  it("scores today's in-progress return against the last bar's forecast", () => {
    const { fields } = computeIndicators(settled);
    const forecast = fields.vnr_sigma[settled.length - 1]!;
    const result = sigmaMove(settled, 0.03);
    expect(result).toEqual({ kind: 'scored', sigma: 0.03 / forecast, basis: 'live' });
  });

  it('reports a gap rather than a σ when the latest bar spans a hole', () => {
    // Drop the second-to-last session, leaving the final bar two sessions out.
    const holed = [...settled.slice(0, -2), settled[settled.length - 1]];
    expect(sigmaMove(holed, 0.03)).toEqual({ kind: 'gap', sessions: 2 });
  });
});
