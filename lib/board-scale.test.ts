import {
  RAMP_COLORS,
  boardSpan,
  hasTighteningCoverage,
  pctSpan,
  rampColor,
  sigmaUnit,
} from './board-scale';

// Ported from Fibenchi web's `board/color-scale.test.ts`: the phone's tiles
// must wear the colours the laptop's do, so the same cases pin both.

const NEUTRAL = RAMP_COLORS[3];

describe('sigmaUnit', () => {
  it('tightens on quiet days but floors at a ±1.5σ range', () => {
    expect(sigmaUnit([0.2, -0.3, 0.1], 3)).toBe(0.5);
    expect(sigmaUnit([2.1, -0.4], 2)).toBeCloseTo(0.7);
  });
  it('caps at the canonical ±3σ on wild days', () => {
    expect(sigmaUnit([4.2, -1.0], 2)).toBe(1);
  });
  it('refuses to tighten onto a partial board', () => {
    expect(sigmaUnit([0.2, -0.3], 10)).toBe(1);
    expect(sigmaUnit([2.1, -0.4, 0.3, 0.1, 0.2, 0.1, 0.4, 0.2, 0.3], 10)).toBeCloseTo(0.7);
  });
});

describe('hasTighteningCoverage', () => {
  it('holds at the boundary on a non-round board', () => {
    expect(hasTighteningCoverage(0, 0)).toBe(false);
    expect(hasTighteningCoverage(70, 78)).toBe(false);
    expect(hasTighteningCoverage(71, 78)).toBe(true);
  });
});

describe('pctSpan', () => {
  it("tracks the day's biggest move within ±2 … ±7", () => {
    expect(pctSpan([0.3, -0.8], 2)).toBe(2);
    expect(pctSpan([4.1, -1.2], 2)).toBeCloseTo(4.1);
    expect(pctSpan([12, -3], 2)).toBe(7);
    expect(pctSpan([0.3, -0.8], 10)).toBe(7);
  });
});

describe('boardSpan', () => {
  it('is 3 × the σ unit in σ mode and the % span in % mode', () => {
    expect(boardSpan([2.1, -0.4, 0.3], 3, 'sigma')).toBeCloseTo(2.1);
    expect(boardSpan([4.1, -1.2], 2, 'pct')).toBeCloseTo(4.1);
  });
  it('stays canonical while most of the book is still loading', () => {
    expect(boardSpan([0.2], 84, 'sigma')).toBe(3);
  });
});

describe('rampColor', () => {
  it('hits the exact stops at the midpoint and clamped extremes', () => {
    expect(rampColor(0, 3).color).toBe(NEUTRAL);
    expect(rampColor(3, 3).color).toBe(RAMP_COLORS[6]);
    expect(rampColor(-3, 3).color).toBe(RAMP_COLORS[0]);
    expect(rampColor(99, 3).color).toBe(RAMP_COLORS[6]);
  });

  it('moves linearly: adjacent values differ by a shade, not a cliff', () => {
    const c7 = rampColor(0.7, 3).color;
    const c8 = rampColor(0.8, 3).color;
    const green = (hex: string) => parseInt(hex.slice(3, 5), 16);
    expect(c7).not.toBe(NEUTRAL);
    expect(c7).not.toBe(c8);
    expect(green(c8)).toBeGreaterThan(green(c7));
  });

  it('picks dark ink only on light fills', () => {
    expect(rampColor(0, 3).ink).toBe('#ffffff');
    expect(rampColor(-3, 3).ink).toBe('#ffffff');
  });
});
