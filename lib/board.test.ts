import type { MarketState, Quote } from '@/lib/market';

import { buildBoard } from './board';
import type { PulseAsset } from './pulse';

// The Board's rules are the web board's: one scale over the whole book, a
// symbol in every section it belongs to, and Open hiding tiles without
// re-scaling the rest.

const quote = (symbol: string, marketState: MarketState): Quote => ({
  symbol,
  price: 100,
  previousClose: 100,
  change: 0,
  changePercent: 0,
  dayHigh: null,
  dayLow: null,
  volume: null,
  currency: 'USD',
  shortName: null,
  marketState,
  isOpen: marketState === 'regular',
  marketTime: 0,
  regularWindow: null,
});

function asset(
  symbol: string,
  score: number | null,
  changePct: number | null,
  marketState: MarketState = 'regular',
  pending = false
): PulseAsset {
  return {
    symbol,
    quote: quote(symbol, marketState),
    sigma: pending
      ? null
      : score === null
        ? { kind: 'warmup', returns: 10, needed: 60 }
        : { kind: 'scored', sigma: score, basis: 'close', barIndex: 1 },
    rank: score === null ? null : Math.abs(score),
    score,
    price: 100,
    changePct,
    live: marketState === 'regular',
    stamp: null,
    unscored: pending || score !== null ? null : 'building baseline',
    misses: 0,
    updatedAt: 0,
  };
}

const NOW = new Date(2026, 7, 20, 15, 0).getTime();

const ASSETS = [
  asset('NVDA', 2.1, 3.0, 'regular'),
  asset('ASML', -0.4, -1.0, 'closed'),
  asset('BTC-USD', 0.3, 0.5, 'regular'),
  asset('NEW', null, 0.8, 'post'),
  asset('SLOW', null, null, 'pre', true),
];

const SECTIONS = [
  { title: 'Hotlist', symbols: ['NVDA', 'ASML'] },
  { title: 'Crypto', symbols: ['BTC-USD'] },
  { title: 'Radar', symbols: ['NVDA', 'NEW', 'SLOW', 'GONE'] },
];

describe('buildBoard', () => {
  it('shows a symbol in every section it belongs to and skips unknown ones', () => {
    const board = buildBoard(ASSETS, SECTIONS, 'sigma', 'all', {}, NOW);
    expect(board.sections.map((s) => s.tiles.map((t) => t.asset.symbol))).toEqual([
      ['NVDA', 'ASML'],
      ['BTC-USD'],
      ['NVDA', 'NEW', 'SLOW'],
    ]);
  });

  it('reads σ or today % by mode', () => {
    const sigma = buildBoard(ASSETS, SECTIONS, 'sigma', 'all', {}, NOW).sections[0].tiles[0].value;
    const pct = buildBoard(ASSETS, SECTIONS, 'pct', 'all', {}, NOW).sections[0].tiles[0].value;
    expect(sigma).toBe(2.1);
    expect(pct).toBe(3.0);
  });

  it('filters to regular sessions without re-scaling, and drops emptied sections', () => {
    const all = buildBoard(ASSETS, SECTIONS, 'sigma', 'all', {}, NOW);
    const open = buildBoard(ASSETS, SECTIONS, 'sigma', 'open', {}, NOW);
    expect(open.sections.map((s) => s.title)).toEqual(['Hotlist', 'Crypto', 'Radar']);
    expect(open.sections[0].tiles.map((t) => t.asset.symbol)).toEqual(['NVDA']);
    expect(open.span).toBe(all.span);

    const closedOnly = buildBoard(
      ASSETS,
      [{ title: 'EU', symbols: ['ASML'] }],
      'sigma',
      'open',
      {},
      NOW
    );
    expect(closedOnly.sections).toHaveLength(0);
  });

  it('counts coverage over the book: open, scored, and still loading', () => {
    expect(buildBoard(ASSETS, SECTIONS, 'sigma', 'all', {}, NOW).coverage).toEqual({
      open: 2,
      scored: 3,
      pending: 1,
      total: 5,
    });
  });

  it('gives every tile its three window returns, null without bars', () => {
    const day = (iso: string, close: number) => ({
      time: Date.parse(`${iso}T12:00:00Z`) / 1000,
      open: close,
      high: close,
      low: close,
      close,
      adjClose: null,
      volume: null,
    });
    const daily = { NVDA: [day('2026-07-20', 80), day('2026-08-06', 90), day('2026-08-13', 95)] };
    const board = buildBoard(ASSETS, SECTIONS, 'sigma', 'all', daily, NOW);
    const [nvda, asml] = board.sections[0].tiles;
    // Live price 100 against the closes the windows start from.
    expect(nvda.windows['1wk']).toBeCloseTo((100 / 95 - 1) * 100);
    expect(nvda.windows['2wk']).toBeCloseTo((100 / 90 - 1) * 100);
    expect(nvda.windows['1mo']).toBeCloseTo(25);
    expect(asml.windows).toEqual({ '1wk': null, '2wk': null, '1mo': null });
  });

  it('holds the canonical span while too little of the book has a reading', () => {
    // 3 of 5 scored is under the 0.9 gate, so the ramp may not tighten.
    expect(buildBoard(ASSETS, SECTIONS, 'sigma', 'all', {}, NOW).span).toBe(3);
  });
});
