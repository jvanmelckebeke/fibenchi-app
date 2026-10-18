import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { fetchPulse } from '@/lib/config/pulse';
import type { MoveScales } from '@/lib/move-scale';

import { useDailyBook, useMoveScales } from './daily';

// The move bars fill only from the scales in fibenchi's pulse bundle. A bundle
// that fails on a cold open sends the book to Yahoo, which has none, so the
// scales have to come from a later bundle or every bar stays an empty track.

jest.mock('@/lib/config/pulse', () => ({
  fetchPulse: jest.fn(),
  pulseBars: () => null,
}));
jest.mock('@/lib/market', () => ({
  market: { getDaily: jest.fn(async () => [{ time: 0, close: 1 }]) },
}));
jest.mock('@/lib/compute', () => ({ indicatorHistoryPeriod: () => '6mo' }));

const scale = {
  quantiles: Array.from({ length: 21 }, (_, i) => i),
  samples: 250,
  lookbackDays: 364,
};
const moveScale: MoveScales = { '1wk': scale, '2wk': scale, '1mo': null };
const bundle = {
  version: 1,
  generatedAt: '2026-10-18T10:00:00Z',
  symbols: { NVDA: { closes: [], tail: [], moveScale } },
  missing: [],
};

const pulse = fetchPulse as jest.MockedFunction<typeof fetchPulse>;
let seen: Record<string, MoveScales | undefined> = {};

function Book({ revision }: { revision: number }) {
  useDailyBook(['NVDA'], revision, 'https://fibenchi.test');
  seen = useMoveScales(['NVDA'], revision);
  return null;
}

const flush = () => act(async () => {});

it('takes the scales from a later bundle when the first one failed', async () => {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  pulse.mockResolvedValueOnce(null).mockResolvedValue(bundle as never);

  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    root = TestRenderer.create(createElement(Book, { revision: 0 }));
  });
  await flush();
  expect(pulse).toHaveBeenCalledTimes(1);
  expect(seen.NVDA).toBeUndefined();

  // A revision inside the retry window doesn't ask again.
  now += 10_000;
  await act(async () => root.update(createElement(Book, { revision: 1 })));
  expect(pulse).toHaveBeenCalledTimes(1);

  now += 60_000;
  await act(async () => root.update(createElement(Book, { revision: 2 })));
  await flush();
  expect(pulse).toHaveBeenCalledTimes(2);

  await act(async () => root.update(createElement(Book, { revision: 3 })));
  expect(seen.NVDA).toEqual(moveScale);

  // Scales in hand: no further requests.
  now += 120_000;
  await act(async () => root.update(createElement(Book, { revision: 4 })));
  expect(pulse).toHaveBeenCalledTimes(2);
});
