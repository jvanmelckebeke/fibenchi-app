import { SIGMA_MOVE_WARMUP } from '@/lib/compute';
import type { OhlcBar, Quote } from '@/lib/market';
import type { QuoteState } from '@/stores/quotes';

import { PULSE_ROWS, buildPulseBook, type PulseInput } from './pulse';
import { formatSigma, sigmaBarColor, sigmaChipStyle } from './sigma-ramp';

// The screen's claims are arithmetic claims: five rows ranked by |σ|, breadth
// counted over *only* what is trading, and a reason for every asset without a
// reading. Those are worth pinning; the pixels are not.

const DAY = 86_400;
const MONDAY = 1_780_272_000;

/** A settled daily series: enough sessions past warmup, `move` on the last bar. */
function series(move = 0.01, sessions = SIGMA_MOVE_WARMUP + 30): OhlcBar[] {
  const bars: OhlcBar[] = [];
  let day = 0;
  let close = 100;
  while (bars.length < sessions) {
    const weekday = day % 7; // MONDAY is a Monday, so 5/6 are the weekend
    if (weekday >= 5) {
      day++;
      continue;
    }
    // A steady 1% zig-zag builds the baseline (σ ≈ 0.01), so the last bar's
    // `move` lands at roughly move/0.01 σ.
    const last = bars.length === sessions - 1;
    close *= last ? 1 + move : 1 + (bars.length % 2 === 0 ? 0.01 : -0.01);
    bars.push({
      time: MONDAY + day * DAY,
      open: close,
      high: close,
      low: close,
      close,
      adjClose: null,
      volume: null,
    });
    day++;
  }
  return bars;
}

const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: 'X',
  price: 101,
  previousClose: 100,
  change: 1,
  changePercent: 1,
  dayHigh: null,
  dayLow: null,
  volume: null,
  currency: 'USD',
  shortName: null,
  marketState: 'regular',
  isOpen: true,
  marketTime: 0,
  regularWindow: null,
  ...over,
});

const state = (over: Partial<QuoteState> = {}): QuoteState => ({
  quote: quote(),
  updatedAt: Date.now(),
  misses: 0,
  ...over,
});

function input(over: Partial<PulseInput> = {}): PulseInput {
  return {
    symbols: [],
    quotes: {},
    daily: {},
    cadenceMs: 20_000,
    now: Date.now(),
    ...over,
  };
}

describe('ranking', () => {
  it('shows the five most extreme |σ| and tails the rest', () => {
    // Eight symbols with increasing last-bar moves — bigger move, bigger |σ|.
    const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const daily: Record<string, OhlcBar[]> = {};
    const quotes: Record<string, QuoteState> = {};
    symbols.forEach((symbol, i) => {
      daily[symbol] = series(0.01 + i * 0.01);
      quotes[symbol] = state({ quote: quote({ symbol, isOpen: false, marketState: 'closed' }) });
    });

    const book = buildPulseBook(input({ symbols, quotes, daily }));
    expect(book.top).toHaveLength(PULSE_ROWS);
    expect(book.tail).toHaveLength(3);
    expect(book.scored).toBe(8);
    // Descending |σ|, so the largest moves lead.
    expect(book.top.map((a) => a.symbol)).toEqual(['H', 'G', 'F', 'E', 'D']);
    const ranks = book.top.map((a) => a.rank!);
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it('ranks on |σ| — a big down move outranks a small up move', () => {
    const symbols = ['UP', 'DOWN'];
    const book = buildPulseBook(
      input({
        symbols,
        daily: { UP: series(0.015), DOWN: series(-0.05) },
        quotes: {
          UP: state({ quote: quote({ symbol: 'UP', isOpen: false }) }),
          DOWN: state({ quote: quote({ symbol: 'DOWN', isOpen: false }) }),
        },
      })
    );
    expect(book.top[0].symbol).toBe('DOWN');
    expect(book.top[0].score).toBeLessThan(0);
  });
});

describe('breadth', () => {
  it('counts only assets on a venue that is open right now', () => {
    const book = buildPulseBook(
      input({
        symbols: ['OPEN_UP', 'OPEN_DOWN', 'CLOSED_UP', 'NO_QUOTE'],
        quotes: {
          OPEN_UP: state({ quote: quote({ symbol: 'OPEN_UP', changePercent: 2 }) }),
          OPEN_DOWN: state({ quote: quote({ symbol: 'OPEN_DOWN', changePercent: -1 }) }),
          // Yesterday's number: aggregating it with today's would be a figure
          // about nothing (spec principle 4).
          CLOSED_UP: state({
            quote: quote({ symbol: 'CLOSED_UP', changePercent: 5, isOpen: false }),
          }),
          NO_QUOTE: state({ quote: undefined, misses: 3 }),
        },
      })
    );
    expect(book.breadth).toEqual({ up: 1, down: 1, live: 2 });
  });

  it('counts an asset with a day move but no σ — the two are different questions', () => {
    const book = buildPulseBook(
      input({
        symbols: ['NO_SIGMA'],
        // No daily bars at all → no σ, but the quote still has a %.
        quotes: { NO_SIGMA: state({ quote: quote({ symbol: 'NO_SIGMA', changePercent: 3 }) }) },
      })
    );
    expect(book.breadth.live).toBe(1);
    expect(book.scored).toBe(0);
  });
});

describe('coverage', () => {
  it('explains a warmup gap in the screen’s own words', () => {
    const book = buildPulseBook(
      input({
        symbols: ['NEW'],
        daily: { NEW: series(0.02, 20) },
        quotes: { NEW: state({ quote: quote({ symbol: 'NEW' }) }) },
      })
    );
    expect(book.scored).toBe(0);
    expect(book.unscored[0].unscored).toMatch(
      new RegExp(`building baseline · \\d+ of ${SIGMA_MOVE_WARMUP} bars`)
    );
  });

  it('reports a dropped symbol as dropped, not as loading', () => {
    const book = buildPulseBook(
      input({
        symbols: ['GONE'],
        quotes: { GONE: state({ quote: undefined, misses: 4, updatedAt: Date.now() }) },
      })
    );
    expect(book.unscored[0].unscored).toMatch(/no quote since \d\d:\d\d · 4 polls missed/);
  });

  it('says nothing about a symbol that is merely still loading', () => {
    const book = buildPulseBook(
      input({ symbols: ['SLOW'], quotes: { SLOW: state({ quote: undefined, misses: 0 }) } })
    );
    expect(book.unscored).toHaveLength(0);
  });
});

describe('staleness', () => {
  it('flags the screen stale when nothing lands while venues are open', () => {
    const now = Date.now();
    const book = buildPulseBook(
      input({
        symbols: ['A'],
        now,
        quotes: { A: state({ quote: quote({ symbol: 'A' }), updatedAt: now - 90_000 }) },
      })
    );
    expect(book.offlineFor).toBeGreaterThan(60_000);
  });

  it('does not call a closed book stale — quiet is the correct output', () => {
    const now = Date.now();
    const book = buildPulseBook(
      input({
        symbols: ['A'],
        now,
        quotes: {
          A: state({
            quote: quote({ symbol: 'A', isOpen: false, marketState: 'closed' }),
            updatedAt: now - 6 * 3_600_000,
          }),
        },
      })
    );
    expect(book.offlineFor).toBeNull();
  });
});

describe('stamps', () => {
  it('has no stamp while the venue is trading', () => {
    const book = buildPulseBook(
      input({ symbols: ['A'], quotes: { A: state({ quote: quote({ symbol: 'A' }) }) } })
    );
    expect(book.unscored).toHaveLength(0);
    expect(book.breadth.live).toBe(1);
  });

  it("stamps today's finished session with when it closed, not with the venue", () => {
    const now = Date.now();
    const closedAt = Math.floor(now / 1000) - 3_600;
    const book = buildPulseBook(
      input({
        symbols: ['A'],
        now,
        // Last bar dated today → today's session has run and closed.
        daily: { A: endingToday(series(0.02), now) },
        quotes: {
          A: state({
            quote: quote({
              symbol: 'A',
              isOpen: false,
              marketState: 'closed',
              regularWindow: { start: closedAt - 28_800, end: closedAt },
            }),
          }),
        },
      })
    );
    expect(book.top[0].stamp).toMatch(/^closed \d\d:\d\d$/);
  });

  it("stamps an older session as yesterday's close", () => {
    const now = Date.now();
    const book = buildPulseBook(
      input({
        symbols: ['A'],
        now,
        daily: { A: series(0.02) }, // fixture timeline, nowhere near today
        quotes: {
          A: state({ quote: quote({ symbol: 'A', isOpen: false, marketState: 'pre' }) }),
        },
      })
    );
    expect(book.top[0].stamp).toBe("yesterday's close");
  });

  it("shows a closed row's own session close, not its extended-hours print", () => {
    const now = Date.now();
    const bars = series(0.02);
    const last = bars[bars.length - 1];
    const prior = bars[bars.length - 2];
    const book = buildPulseBook(
      input({
        symbols: ['A'],
        now,
        daily: { A: bars },
        quotes: {
          A: state({
            // A pre-market print 6% above the last close: putting this % beside
            // yesterday's σ would make one row talk about two sessions.
            quote: quote({
              symbol: 'A',
              isOpen: false,
              marketState: 'pre',
              price: last.close * 1.06,
              previousClose: last.close,
              changePercent: 6,
            }),
          }),
        },
      })
    );
    expect(book.top[0].price).toBeCloseTo(last.close, 8);
    expect(book.top[0].changePct).toBeCloseTo((last.close / prior.close - 1) * 100, 8);
  });
});

/** Re-stamp a series so its last bar falls on `now`'s UTC day. */
function endingToday(bars: OhlcBar[], now: number): OhlcBar[] {
  const shift = Math.floor(now / 1000) - bars[bars.length - 1].time;
  return bars.map((bar) => ({ ...bar, time: bar.time + shift }));
}

describe('the σ ramp', () => {
  it('is neutral grey in the middle, never a hue', () => {
    expect(sigmaChipStyle(0).background).toBe('#323235');
    expect(sigmaChipStyle(0.9).background).toBe(sigmaChipStyle(-0.9).background);
  });

  it('rims only the extremes, in the full-saturation hue', () => {
    expect(sigmaChipStyle(2.9).rim).toBeNull();
    expect(sigmaChipStyle(3.1).rim).toBe('#24c45e');
    expect(sigmaChipStyle(-3.1).rim).toBe('#ed5351');
  });

  it('never repeats a fill across the seven classes', () => {
    const fills = [-4, -2.5, -1.5, 0, 1.5, 2.5, 4].map((s) => sigmaChipStyle(s).background);
    expect(new Set(fills).size).toBe(7);
  });

  it('renders an unscored tail bar in the neutral class', () => {
    expect(sigmaBarColor(null)).toBe(sigmaChipStyle(0).background);
  });

  it('always signs the chip label', () => {
    expect(formatSigma(3.14)).toBe('+3.1σ');
    expect(formatSigma(-0.44)).toBe('−0.4σ');
  });
});
