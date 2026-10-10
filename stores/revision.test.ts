import { throttle } from './revision';

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs a lone call on the next tick and folds a burst into one run per window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 1_000);
    t.call();
    jest.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 50; i++) t.call();
    jest.advanceTimersByTime(999);
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('drops a pending run when cancelled', () => {
    const fn = jest.fn();
    const t = throttle(fn, 1_000);
    t.call();
    t.cancel();
    jest.advanceTimersByTime(5_000);
    expect(fn).not.toHaveBeenCalled();
  });
  it('turns a cold open of 178 arrivals in two seconds into a few runs', () => {
    const fn = jest.fn();
    const t = throttle(fn, 1_000);
    for (let i = 0; i < 178; i++) {
      t.call();
      jest.advanceTimersByTime(11);
    }
    jest.advanceTimersByTime(1_000);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(3);
  });
});
