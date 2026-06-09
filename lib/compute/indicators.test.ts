import type { OhlcBar } from '@/lib/market';

import fixtures from './__fixtures__/indicator.fixtures.json';
import { buildIndicatorSnapshot, computeIndicators } from './indicators';

// Golden-vector parity: the fixtures are produced by Fibenchi's pandas reference
// (fibenchi/backend/scripts/export_indicator_contract.py). Feeding the same input
// to our hand-written TS kernels must reproduce the same series + snapshot — this
// is what pins EMA adjust=False / Wilder smoothing and prevents silent drift.

interface FixtureBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Fixtures {
  input: FixtureBar[];
  expected: {
    series: Record<string, (number | null)[]>;
    snapshot: {
      close: number;
      changePct: number;
      values: Record<string, number | string | null>;
    };
  };
}

const data = fixtures as unknown as Fixtures;

const bars: OhlcBar[] = data.input.map((b) => ({
  time: b.time,
  open: b.open,
  high: b.high,
  low: b.low,
  close: b.close,
  adjClose: null,
  volume: b.volume,
}));

const EPS = 1e-6;
const near = (a: number | null, e: number | null): boolean =>
  e === null ? a === null : a !== null && Math.abs(a - e) < EPS;

describe('indicator parity with the pandas reference (golden vectors)', () => {
  const computed = computeIndicators(bars);

  for (const [field, expected] of Object.entries(data.expected.series)) {
    it(`series "${field}" matches within ${EPS}`, () => {
      const actual = computed.fields[field];
      expect(actual).toBeDefined();
      expect(actual.length).toBe(expected.length);
      // Report the offending bars rather than just "false" on a mismatch.
      const mismatches = expected
        .map((e, i) => ({ i, expected: e, actual: actual[i] }))
        .filter(({ expected: e, actual: a }) => !near(a, e));
      expect(mismatches).toEqual([]);
    });
  }

  it('snapshot (rounded latest values + derived) matches the reference', () => {
    const snap = buildIndicatorSnapshot(bars);
    expect(snap).not.toBeNull();
    expect(snap!.close).toBeCloseTo(data.expected.snapshot.close, 6);
    expect(snap!.changePct).toBeCloseTo(data.expected.snapshot.changePct, 6);
    for (const [field, value] of Object.entries(data.expected.snapshot.values)) {
      if (typeof value === 'number') {
        expect(snap!.values[field]).toBeCloseTo(value, 6);
      } else {
        expect(snap!.values[field]).toBe(value);
      }
    }
  });
});
