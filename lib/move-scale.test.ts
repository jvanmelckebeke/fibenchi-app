import { movePercentile, type MoveScale } from './move-scale';

/** Quantiles 0, 1, 2, …, 20 %: the percentile of v% is then v x 5%. */
const linear: MoveScale = {
  quantiles: Array.from({ length: 21 }, (_, i) => i),
  samples: 250,
  lookbackDays: 364,
};

describe('movePercentile', () => {
  it('places a move on the curve by size, either sign', () => {
    expect(movePercentile(5, linear)).toBeCloseTo(0.25);
    expect(movePercentile(-5, linear)).toBeCloseTo(0.25);
    expect(movePercentile(12.5, linear)).toBeCloseTo(0.625);
  });

  it('clamps below the smallest and at or above the largest move', () => {
    const shifted = { ...linear, quantiles: linear.quantiles.map((q) => q + 1) };
    expect(movePercentile(0.5, shifted)).toBe(0);
    expect(movePercentile(21, shifted)).toBe(1);
    expect(movePercentile(80, shifted)).toBe(1);
  });

  it('resolves equal quantiles upward', () => {
    const flat = { ...linear, quantiles: [0, 1, 1, 1, ...linear.quantiles.slice(4)] };
    // 1% equals p5, p10 and p15; it ranks at the last of them.
    expect(movePercentile(1, flat)).toBeCloseTo(0.15);
  });

  it('has no reading without a scale or a move', () => {
    expect(movePercentile(5, null)).toBeNull();
    expect(movePercentile(null, linear)).toBeNull();
  });

  it('reads gold +3% and OKLO +12% as about equally unusual (the mockup case)', () => {
    // Shapes like their real 1wk distributions: gold's median 2.1%, OKLO's 7.6%.
    const gold = { ...linear, quantiles: linear.quantiles.map((i) => i * 0.29) };
    const oklo = { ...linear, quantiles: linear.quantiles.map((i) => i * 1.1) };
    const g = movePercentile(3, gold)!;
    const o = movePercentile(12, oklo)!;
    expect(Math.abs(g - o)).toBeLessThan(0.05);
  });
});
