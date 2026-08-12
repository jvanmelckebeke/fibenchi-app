import type { Quote } from '@/lib/market';

import { nextPollDelay } from './quotes';

// The polling policy *is* the fetch budget: 44 symbols asking every 5s is a
// different app from 22 asking every 20s while the other half sleeps to its bell.

const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: 'AAPL',
  price: 100,
  previousClose: 99,
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

describe('nextPollDelay', () => {
  it('polls an open venue at the screen cadence', () => {
    expect(nextPollDelay(quote(), 'detail')).toBe(5_000);
    expect(nextPollDelay(quote(), 'glance')).toBe(20_000);
  });

  it('sleeps to the next bell for a closed venue instead of re-asking', () => {
    const inTwoMinutes = Math.floor(Date.now() / 1000) + 120;
    const delay = nextPollDelay(
      quote({
        isOpen: false,
        marketState: 'closed',
        regularWindow: { start: inTwoMinutes, end: 0 },
      }),
      'glance'
    );
    // Just past the bell (plus jitter) — not the 20s live cadence, not a minute.
    expect(delay).toBeGreaterThan(120_000);
    expect(delay).toBeLessThan(126_000);
  });

  it('treats pre/post as closed — the price is not moving on our data', () => {
    expect(
      nextPollDelay(quote({ isOpen: false, marketState: 'pre', regularWindow: null }), 'glance')
    ).toBe(600_000);
  });

  it('falls back to a long re-check when the bell is unknown or already past', () => {
    const anHourAgo = Math.floor(Date.now() / 1000) - 3_600;
    expect(nextPollDelay(quote({ isOpen: false, regularWindow: null }), 'glance')).toBe(600_000);
    expect(
      nextPollDelay(quote({ isOpen: false, regularWindow: { start: anHourAgo, end: 0 } }), 'glance')
    ).toBe(600_000);
  });

  it('caps the sleep so a stale window cannot park a loop for a day', () => {
    const tomorrow = Math.floor(Date.now() / 1000) + 86_400;
    expect(
      nextPollDelay(quote({ isOpen: false, regularWindow: { start: tomorrow, end: 0 } }), 'glance')
    ).toBe(30 * 60_000);
  });

  it('retries a dropped symbol sooner than a closed venue — a miss is transport', () => {
    expect(nextPollDelay(undefined, 'glance')).toBe(30_000);
  });
});
