import { __resetClientState, fetchYahooJson, requestStats } from './client';

// The client's job under partial rate-limiting is to get *smaller*, not bigger.
// These cover the two ways it previously got bigger: retrying a throttle
// response, and a breaker that couldn't trip while most requests were failing.

const okResponse = () => ({ ok: true, status: 200, json: async () => ({ chart: {} }) });
const httpResponse = (status: number) => ({ ok: false, status, json: async () => ({}) });

let fetchMock: jest.Mock;

beforeEach(() => {
  __resetClientState();
  fetchMock = jest.fn();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

describe('retry policy', () => {
  it('does not retry a 429 — the throttle is the answer, not a transport failure', async () => {
    fetchMock.mockResolvedValue(httpResponse(429));
    await expect(fetchYahooJson('/x')).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 403', async () => {
    fetchMock.mockResolvedValue(httpResponse(403));
    await expect(fetchYahooJson('/x')).rejects.toThrow(/403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 404 — the other host answers a bad symbol the same way', async () => {
    fetchMock.mockResolvedValue(httpResponse(404));
    await expect(fetchYahooJson('/x')).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a connection error once, on the other host', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(okResponse());
    await expect(fetchYahooJson('/x')).resolves.toEqual({ chart: {} });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [first, second] = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(first).toContain('query1');
    expect(second).toContain('query2');
  });
});

describe('circuit breaker', () => {
  it('opens on the failure rate even when successes interleave', async () => {
    // The failure mode the consecutive counter missed: with many per-symbol loops
    // in flight, a throttled burst arrives as alternating ok/429, so a counter
    // that resets on any success never reaches its threshold.
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call++;
      return call % 2 === 0 ? okResponse() : httpResponse(429);
    });

    for (let i = 0; i < 10; i++) {
      await fetchYahooJson('/x').catch(() => null);
    }

    expect(requestStats().circuitOpen).toBe(true);
    const before = fetchMock.mock.calls.length;
    await expect(fetchYahooJson('/x')).rejects.toThrow(/circuit open/);
    // Nothing left the device while the circuit is open.
    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('stays closed while requests are mostly succeeding', async () => {
    let call = 0;
    fetchMock.mockImplementation(async () => {
      call++;
      return call % 5 === 0 ? httpResponse(429) : okResponse();
    });
    for (let i = 0; i < 20; i++) {
      await fetchYahooJson('/x').catch(() => null);
    }
    expect(requestStats().circuitOpen).toBe(false);
    expect(requestStats().failureRate).toBeLessThan(0.5);
  });
});

describe('concurrency gate', () => {
  it('never has more than 6 requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return okResponse();
    });

    await Promise.all(Array.from({ length: 30 }, () => fetchYahooJson('/x')));
    expect(peak).toBe(6);
  });
});
