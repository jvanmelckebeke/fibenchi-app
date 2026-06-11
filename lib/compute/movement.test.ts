import type { IntradayResult } from '@/lib/market';

import { computeIntradayStats } from './movement';

const intraday = (previousClose: number, prices: number[]): IntradayResult => ({
  symbol: 'TEST',
  previousClose,
  points: prices.map((price, i) => ({ time: 1_700_000_000 + i * 60, price })),
});

describe('computeIntradayStats', () => {
  it('returns null with fewer than 2 points', () => {
    expect(computeIntradayStats(intraday(100, [101]))).toBeNull();
  });

  it('returns null when the previous close is invalid', () => {
    expect(computeIntradayStats(intraday(0, [101, 102]))).toBeNull();
  });

  it('measures day return from the previous close, not the first print', () => {
    // Opens at 99 (below prior close 100), ends at 102 → +2% on the day.
    const stats = computeIntradayStats(intraday(100, [99, 101, 102]));
    expect(stats?.dayReturnPct).toBeCloseTo(2, 6);
  });

  it('tracks session high and low across the trajectory', () => {
    const stats = computeIntradayStats(intraday(100, [100, 105, 98, 103]));
    expect(stats?.high).toBe(105);
    expect(stats?.low).toBe(98);
  });

  it('reports the largest peak-to-trough decline as a negative percent', () => {
    // Peak 110, trough 99 after it → (99/110 - 1) = -10%.
    const stats = computeIntradayStats(intraday(100, [100, 110, 99, 104]));
    expect(stats?.drawdownPct).toBeCloseTo(-10, 6);
  });

  it('reports zero drawdown for a monotonically rising session', () => {
    const stats = computeIntradayStats(intraday(100, [100, 101, 102, 103]));
    expect(stats?.drawdownPct).toBe(0);
  });
});
