import { sigmaMove } from '@/lib/compute';

import { fetchPulse, pulseBars, type CompanionPulse } from './pulse';

const DAY = 86_400;

/** Thirty weekday closes ending Thursday 2026-10-08, with the server's tail. */
function entry(): CompanionPulse['symbols'][string] {
  const closes: { date: string; close: number }[] = [];
  let t = Date.UTC(2026, 8, 1) / 1000;
  while (closes.length < 28) {
    const weekday = new Date(t * 1000).getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      closes.push({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        close: 100 + closes.length,
      });
    }
    t += DAY;
  }
  const [prev, last] = closes.slice(-2);
  return {
    closes,
    moveScale: null,
    tail: [
      { ...prev, vnr: 0.4, vnrSigma: 0.01, gapSessions: null, returns: 119 },
      { ...last, vnr: 1.2, vnrSigma: 0.012, gapSessions: null, returns: 120 },
    ],
  };
}

const bundle = (symbols: Record<string, unknown>) => ({
  version: 1,
  generatedAt: '2026-10-08T21:00:00Z',
  symbols,
  missing: [],
});

describe('pulseBars', () => {
  it("turns closes into daily bars and scores σ from the server's tail", () => {
    const bars = pulseBars(entry())!;
    expect(bars).toHaveLength(28);
    expect(new Date(bars[27].time * 1000).toISOString().slice(0, 10)).toBe('2026-10-08');
    // No live quote: the last completed bar's own σ, as the server computed it.
    expect(sigmaMove(bars)).toEqual({ kind: 'scored', sigma: 1.2, basis: 'close', barIndex: 27 });
  });

  it("scores today's live move against the server's forecast", () => {
    const bars = pulseBars(entry())!;
    const live = {
      dayReturn: 0.024,
      price: null,
      sessionOpen: true,
      asOf: Date.UTC(2026, 9, 9, 15) / 1000, // Friday, trading
    };
    const result = sigmaMove(bars, live);
    expect(result.kind === 'scored' && result.basis).toBe('live');
    expect(result.kind === 'scored' && result.sigma).toBeCloseTo(2);
  });

  it('reports warmup from the server count', () => {
    const e = entry();
    e.tail = e.tail.map((p) => ({ ...p, vnr: null, vnrSigma: null, returns: 40 }));
    expect(sigmaMove(pulseBars(e)!)).toEqual({ kind: 'warmup', returns: 40, needed: 60 });
  });

  it('refuses an entry whose tail does not match its closes', () => {
    const e = entry();
    e.tail[1] = { ...e.tail[1], date: '2026-10-09' };
    expect(pulseBars(e)).toBeNull();
    expect(pulseBars({ closes: [], tail: [], moveScale: null })).toBeNull();
  });
});

function respond(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('fetchPulse', () => {
  it('decodes a bundle from the companion path', async () => {
    respond(200, bundle({ IBM: entry() }));
    const pulse = await fetchPulse('https://fibenchi.example/');
    expect(Object.keys(pulse!.symbols)).toEqual(['IBM']);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://fibenchi.example/api/companion/pulse'
    );
  });

  it("keeps each symbol's move scales, and reads an older server's missing field as null", async () => {
    const scale = {
      quantiles: Array.from({ length: 21 }, (_, i) => i),
      samples: 250,
      lookbackDays: 364,
    };
    const withScale = { ...entry(), moveScale: { '1wk': scale, '2wk': scale, '1mo': null } };
    const { moveScale, ...older } = entry();
    respond(200, bundle({ IBM: withScale, OLD: older }));
    const pulse = await fetchPulse('https://fibenchi.example');
    expect(pulse!.symbols.IBM.moveScale?.['1wk']?.quantiles).toHaveLength(21);
    expect(pulse!.symbols.IBM.moveScale?.['1mo']).toBeNull();
    expect(pulse!.symbols.OLD.moveScale).toBeNull();
  });

  it('falls back (null) on 404, a newer version, a bad payload, no endpoint or no network', async () => {
    respond(404, { detail: 'Not Found' });
    expect(await fetchPulse('https://fibenchi.example')).toBeNull();
    respond(200, { ...bundle({}), version: 2 });
    expect(await fetchPulse('https://fibenchi.example')).toBeNull();
    respond(200, { ...bundle({}), symbols: 'nope' });
    expect(await fetchPulse('https://fibenchi.example')).toBeNull();
    expect(await fetchPulse(null)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await fetchPulse('https://fibenchi.example')).toBeNull();
  });
});
