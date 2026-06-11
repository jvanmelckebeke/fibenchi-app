import { resolveCurrency } from './currency';

describe('resolveCurrency', () => {
  it('passes a plain major-unit currency through with divisor 1', () => {
    expect(resolveCurrency('USD', 'AAPL')).toEqual({ code: 'USD', divisor: 1 });
    expect(resolveCurrency('EUR', 'ASML.AS')).toEqual({ code: 'EUR', divisor: 1 });
  });

  it('upcases a raw major-unit code', () => {
    expect(resolveCurrency('eur', 'X')).toEqual({ code: 'EUR', divisor: 1 });
  });

  it('normalizes London pence (GBp) to GBP with a /100 divisor', () => {
    expect(resolveCurrency('GBp', 'LLOY.L')).toEqual({ code: 'GBP', divisor: 100 });
    expect(resolveCurrency('GBX', 'LLOY.L')).toEqual({ code: 'GBP', divisor: 100 });
  });

  it('normalizes other subunits (agorot, cents)', () => {
    expect(resolveCurrency('ILA', 'TEVA.TA')).toEqual({ code: 'ILS', divisor: 100 });
    expect(resolveCurrency('ZAc', 'NPN.JO')).toEqual({ code: 'ZAR', divisor: 100 });
  });

  it('does not confuse GBP (pounds) with GBp (pence)', () => {
    expect(resolveCurrency('GBP', 'X.L')).toEqual({ code: 'GBP', divisor: 1 });
  });

  it('falls back to the exchange suffix when currency is absent', () => {
    expect(resolveCurrency(null, '7203.T')).toEqual({ code: 'JPY', divisor: 1 });
    expect(resolveCurrency(null, 'LLOY.L')).toEqual({ code: 'GBP', divisor: 1 });
    expect(resolveCurrency(null, 'SHOP.TO')).toEqual({ code: 'CAD', divisor: 1 });
  });

  it('matches the exchange suffix case-insensitively', () => {
    expect(resolveCurrency(null, 'lloy.l')).toEqual({ code: 'GBP', divisor: 1 });
  });

  it('defaults to USD for a suffixless symbol with no currency', () => {
    expect(resolveCurrency(null, 'AAPL')).toEqual({ code: 'USD', divisor: 1 });
  });

  it('defaults to USD for an unknown suffix with no currency', () => {
    expect(resolveCurrency(null, 'FOO.ZZ')).toEqual({ code: 'USD', divisor: 1 });
  });
});
