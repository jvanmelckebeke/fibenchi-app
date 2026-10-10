import { fetchPortfolioIndex } from './portfolio-index';

const bundle = {
  version: 1,
  generatedAt: '2026-10-08T18:00:00Z',
  period: '1y',
  dates: ['2025-10-08', '2026-10-08'],
  values: [1000, 1123.4],
  current: 1123.4,
  change: 123.4,
  changePct: 12.34,
};

function respond(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('fetchPortfolioIndex', () => {
  it('decodes a bundle and asks for the requested period', async () => {
    respond(200, bundle);
    const index = await fetchPortfolioIndex('https://fibenchi.example/');
    expect(index?.current).toBe(1123.4);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://fibenchi.example/api/companion/portfolio-index?period=1y'
    );
  });

  it('shows no card for a server that predates the endpoint', async () => {
    respond(404, { detail: 'Not Found' });
    expect(await fetchPortfolioIndex('https://fibenchi.example')).toBeNull();
  });

  it('refuses a newer bundle version rather than misreading it', async () => {
    respond(200, { ...bundle, version: 2 });
    expect(await fetchPortfolioIndex('https://fibenchi.example')).toBeNull();
  });

  it('refuses a payload the contract rejects', async () => {
    respond(200, { ...bundle, values: 'nope' });
    expect(await fetchPortfolioIndex('https://fibenchi.example')).toBeNull();
  });

  it('keeps an empty index as nulls, never zeros', async () => {
    respond(200, {
      ...bundle,
      dates: [],
      values: [],
      current: null,
      change: null,
      changePct: null,
    });
    const index = await fetchPortfolioIndex('https://fibenchi.example');
    expect(index?.current).toBeNull();
  });

  it('returns null without an endpoint or when the network fails', async () => {
    expect(await fetchPortfolioIndex(null)).toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await fetchPortfolioIndex('https://fibenchi.example')).toBeNull();
  });
});
