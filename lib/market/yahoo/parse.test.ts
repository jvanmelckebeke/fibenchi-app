import { parseQuote } from './parse';

const chart = (meta: Record<string, unknown>) => ({
  chart: {
    result: [
      { meta: { regularMarketPrice: 102.18, previousClose: 101.9, currency: 'USD', ...meta } },
    ],
  },
});

describe('parseQuote index flag', () => {
  it("reads Yahoo's instrumentType, so an index without ^ is still an index", () => {
    expect(parseQuote(chart({ symbol: 'DX-Y.NYB', instrumentType: 'INDEX' })).isIndex).toBe(true);
    expect(parseQuote(chart({ symbol: '^GSPC', instrumentType: 'INDEX' })).isIndex).toBe(true);
  });

  it('leaves equities, funds and currencies priced', () => {
    expect(parseQuote(chart({ symbol: 'SPY', instrumentType: 'ETF' })).isIndex).toBe(false);
    expect(parseQuote(chart({ symbol: 'JPY=X', instrumentType: 'CURRENCY' })).isIndex).toBe(false);
    expect(parseQuote(chart({ symbol: 'IBM' })).isIndex).toBe(false);
  });
});
