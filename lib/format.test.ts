import {
  currencyDecimals,
  currencySymbol,
  formatCompactPrice,
  formatPrice,
  signedPercent,
  type PriceFormat,
} from './format';

const priced = (currency?: string): PriceFormat => ({ symbol: 'AAPL', currency });

describe('currencySymbol', () => {
  it('maps known codes to their symbol', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('JPY')).toBe('¥');
  });

  it('is case-insensitive', () => {
    expect(currencySymbol('usd')).toBe('$');
  });

  it('falls back to the code + nbsp for unknown currencies', () => {
    expect(currencySymbol('CAD')).toBe('CAD ');
  });
});

describe('currencyDecimals', () => {
  it('is 2 by default', () => {
    expect(currencyDecimals('USD')).toBe(2);
  });

  it('is 0 for zero-decimal currencies', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(currencyDecimals('KRW')).toBe(0);
  });
});

describe('formatPrice', () => {
  it('prefixes the symbol and keeps two decimals', () => {
    expect(formatPrice(12.5, priced('USD'))).toBe('$12.50');
    expect(formatPrice(50, priced('GBP'))).toBe('£50.00');
  });

  it('groups thousands', () => {
    expect(formatPrice(1234567.89, priced('USD'))).toBe('$1,234,567.89');
  });

  it('drops decimals for zero-decimal currencies', () => {
    expect(formatPrice(1200, priced('JPY'))).toBe('¥1,200');
  });

  it('falls back to a bare grouped number while the currency is unknown', () => {
    expect(formatPrice(1234.5, priced(undefined))).toBe('1,234.50');
  });

  it('renders an index as a plain point value, no currency symbol', () => {
    expect(formatPrice(5123.45, { symbol: '^GSPC', currency: 'USD' })).toBe('5,123.45');
  });

  it('appends % for a yield index', () => {
    expect(formatPrice(4.27, { symbol: '^TNX', currency: 'USD' })).toBe('4.27%');
  });
});

describe('formatCompactPrice', () => {
  it('scales millions and billions with the symbol', () => {
    expect(formatCompactPrice(1_500_000, priced('USD'))).toBe('$1.5M');
    expect(formatCompactPrice(2_000_000_000, priced('EUR'))).toBe('€2B');
  });

  it('drops a trailing .0', () => {
    expect(formatCompactPrice(3_000, priced('USD'))).toBe('$3K');
  });

  it('defers to formatPrice below 1000', () => {
    expect(formatCompactPrice(950, priced('USD'))).toBe('$950.00');
  });

  it('drops the symbol while the currency is unknown', () => {
    expect(formatCompactPrice(1_500_000, priced(undefined))).toBe('1.5M');
  });

  it('does not scale an index', () => {
    expect(formatCompactPrice(5123.45, { symbol: '^GSPC' })).toBe('5,123.45');
  });
});

describe('signedPercent', () => {
  it('signs real moves and prints a move that rounds to zero as plain zero', () => {
    expect(signedPercent(1.234, 1)).toBe('+1.2%');
    expect(signedPercent(-0.5)).toBe('-0.50%');
    expect(signedPercent(-0.04, 1)).toBe('0.0%');
    expect(signedPercent(0.001)).toBe('0.00%');
    expect(signedPercent(0)).toBe('0.00%');
  });
});

describe('index prices', () => {
  it('never puts a currency on an index, with or without the ^ prefix', () => {
    expect(formatPrice(102.18, { symbol: 'DX-Y.NYB', currency: 'USD', index: true })).toBe(
      '102.18'
    );
    expect(formatPrice(23785.79, { symbol: '^HSI', currency: 'HKD' })).toBe('23,785.79');
    expect(formatCompactPrice(49313.44, { symbol: 'DX-Y.NYB', currency: 'USD', index: true })).toBe(
      '49,313.44'
    );
  });

  it('keeps the currency on a priced asset', () => {
    expect(formatPrice(102.18, { symbol: 'SPY', currency: 'USD', index: false })).toBe('$102.18');
  });
});
