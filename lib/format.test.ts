import { currencyDecimals, currencySymbol, formatPrice, formatPriceMaybe } from './format';

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
    expect(formatPrice(12.5, 'USD')).toBe('$12.50');
    expect(formatPrice(50, 'GBP')).toBe('£50.00');
  });

  it('groups thousands', () => {
    expect(formatPrice(1234567.89, 'USD')).toBe('$1,234,567.89');
  });

  it('drops decimals for zero-decimal currencies', () => {
    expect(formatPrice(1200, 'JPY')).toBe('¥1,200');
  });

  it('honors an explicit decimals override', () => {
    expect(formatPrice(12.3456, 'USD', 4)).toBe('$12.3456');
  });
});

describe('formatPriceMaybe', () => {
  it('formats with currency when known', () => {
    expect(formatPriceMaybe(50, 'GBP')).toBe('£50.00');
  });

  it('falls back to a bare 2-dp number while currency is unknown', () => {
    expect(formatPriceMaybe(50, undefined)).toBe('50.00');
  });
});
