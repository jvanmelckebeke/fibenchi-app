import type { OhlcBar } from '@/lib/market';

import { INDICATOR_SPECS } from './generated/registry';
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

  it('scores the last completed bar when there is no live quote', () => {
    const result = sigmaMove(settled);
    expect(result.kind).toBe('scored');
    if (result.kind !== 'scored') return;
    expect(result.basis).toBe('close');
    expect(result.barIndex).toBe(settled.length - 1);
    const { fields } = computeIndicators(settled);
    expect(result.sigma).toBeCloseTo(fields.vnr[settled.length - 1]!, 12);
  });

  /** A live quote from a venue that is trading, `dayReturn` as a fraction. */
  const trading = (dayReturn: number, asOf: number) => ({
    dayReturn,
    sessionOpen: true,
    asOf,
  });

  it("scores today's in-progress return against the last completed bar's forecast", () => {
    const { fields } = computeIndicators(settled);
    const last = settled[settled.length - 1];
    const forecast = fields.vnr_sigma[settled.length - 1]!;
    // Venue open, but the last stored bar is *yesterday's* — nothing is forming.
    const result = sigmaMove(settled, trading(0.03, last.time + DAY));
    expect(result).toEqual({
      kind: 'scored',
      sigma: 0.03 / forecast,
      basis: 'live',
      barIndex: settled.length - 1,
    });
  });

  it("ignores today's forming bar — it must not be its own denominator", () => {
    // The venue is trading and the last bar is dated today, so both the score and
    // the forecast have to come from the session before it.
    const { fields } = computeIndicators(settled);
    const last = settled[settled.length - 1];
    const result = sigmaMove(settled, trading(0.03, last.time + 3_600));
    expect(result).toEqual({
      kind: 'scored',
      sigma: 0.03 / fields.vnr_sigma[settled.length - 2]!,
      basis: 'live',
      barIndex: settled.length - 2,
    });
  });

  it('still scores a live return when the stored series has a hole', () => {
    // `price / previousClose` is one session by construction, so a positional
    // hole can't make it span sessions — the guard is about bar arithmetic.
    const holed = [...settled.slice(0, -2), settled[settled.length - 1]];
    const last = holed[holed.length - 1];
    const result = sigmaMove(holed, trading(0.03, last.time + DAY));
    expect(result.kind).toBe('scored');
    if (result.kind === 'scored') expect(result.basis).toBe('live');
  });

  it('reports a gap when the bar-based score is the one that spans a hole', () => {
    const holed = [...settled.slice(0, -2), settled[settled.length - 1]];
    expect(sigmaMove(holed)).toEqual({ kind: 'gap', sessions: 2 });
  });
});


// The floor and the warmup gate are backend-owned decisions the contract ships
// (`params.sigma_floor_frac`, `params.sigma_floor_min_obs`, `warmup`). The
// golden vectors prove the *numbers* match pandas; these prove the app is
// actually wiring them through, which a fixture on a single synthetic series
// can't fully pin.

const VNR_SPEC = INDICATOR_SPECS.find((spec) => spec.key === 'vnr')!;

describe('kernel contract wiring', () => {
  it('carries the floor parameters the backend publishes', () => {
    expect(VNR_SPEC.params.sigma_floor_frac).toBeGreaterThan(0);
    expect(VNR_SPEC.params.sigma_floor_min_obs).toBeGreaterThan(0);
    expect(VNR_SPEC.warmup).toBe(SIGMA_MOVE_WARMUP);
  });

  it('emits no forecast until the contract warmup is met', () => {
    const short = sessions(SIGMA_MOVE_WARMUP - 5, (i) => 100 + (i % 2 === 0 ? 0 : 1));
    const { fields } = computeIndicators(short);
    expect(fields.vnr_sigma.every((v) => v === null)).toBe(true);
    expect(fields.vnr.every((v) => v === null)).toBe(true);
  });

  it('emits a forecast once the baseline exists', () => {
    const long = sessions(SIGMA_MOVE_WARMUP + 10, (i) => 100 + (i % 2 === 0 ? 0 : 1));
    const { fields } = computeIndicators(long);
    expect(fields.vnr_sigma[long.length - 1]).not.toBeNull();
    expect(fields.vnr_sigma[SIGMA_MOVE_WARMUP - 2]).toBeNull();
  });

  it('floors the forecast so a series gone quiet cannot blow up the next move', () => {
    // Normal volatility, then dead flat, then a real +3% day. Unfloored, the
    // EWMA decays toward zero and that move divides by almost nothing.
    // 120 flat sessions is well past where λ=0.94 decays below the floor —
    // at ~1.2%/day the crossover is around 70, so this has real margin.
    const closes: number[] = [];
    for (let i = 0; i < SIGMA_MOVE_WARMUP + 20; i++) closes.push(100 + (i % 2 === 0 ? 0 : 1.2));
    const flat = closes[closes.length - 1];
    for (let i = 0; i < 120; i++) closes.push(flat);
    closes.push(flat * 1.03);
    const last = closes.length - 1;

    const withFloor = computeIndicators(sessions(closes.length, (i) => closes[i])).fields.vnr[last]!;
    // Same warmup, floor off — isolates the floor as the only difference.
    const bare = volatilityNormalizedReturn(closes, VNR_SPEC.params.lam, undefined, {
      warmup: VNR_SPEC.warmup,
    }).vnr[last]!;

    expect(Math.abs(bare)).toBeGreaterThan(60);
    expect(Math.abs(withFloor)).toBeLessThan(Math.abs(bare) / 3);
  });

  it('leaves an ordinary series untouched — the floor is a guard, not a filter', () => {
    const bars = sessions(SIGMA_MOVE_WARMUP + 40, (i) => 100 + (i % 2 === 0 ? 0 : 1.2));
    const wired = computeIndicators(bars).fields.vnr_sigma;
    const unfloored = volatilityNormalizedReturn(
      bars.map((b) => b.close),
      VNR_SPEC.params.lam,
      undefined,
      { warmup: VNR_SPEC.warmup }
    ).vnrSigma;
    expect(wired[bars.length - 1]).toBeCloseTo(unfloored[bars.length - 1]!, 12);
  });
});
