import type { ThemePalette } from '@/lib/theme';

// Shared display helpers for the app's core glance semantics — signed numbers,
// signed percents, and the gain/loss/flat colour mapping. These were duplicated
// across the ticker card, asset detail, movement grid and intraday readout;
// keeping them here means "what counts as up" and "how a percent reads" are
// decided in one place.

/** Direction of a numeric change. Exactly zero is `flat` (its own colour). */
export type Trend = 'up' | 'down' | 'flat';

export function trend(value: number): Trend {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

/** Finance colour for a change: gain (up) / loss (down) / flat (unchanged). */
export function trendColor(value: number, theme: ThemePalette): string {
  switch (trend(value)) {
    case 'up':
      return theme.gain;
    case 'down':
      return theme.loss;
    case 'flat':
      return theme.flat;
  }
}

/** Signed number, e.g. "+1.23", "-0.50", "0.00" (no plus when flat/negative). */
export function signed(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

/** Signed percent, e.g. "+1.23%", "-0.50%", "0.00%". */
export function signedPercent(value: number, decimals = 2): string {
  return `${signed(value, decimals)}%`;
}

// Currency display. Symbols/decimals ported from Fibenchi's `lib/format.ts`;
// prices are already normalized to the major unit at the market parse boundary
// (see `lib/market/yahoo/currency.ts`), so these only handle presentation.

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  GBX: '£',
  ILS: '₪',
  ILA: '₪',
  ZAR: 'R',
  JPY: '¥',
  KRW: '₩',
  CHF: 'CHF ',
};

// Currencies conventionally shown without a fractional part.
const ZERO_DECIMAL_CURRENCIES = new Set(['KRW', 'JPY', 'IDR', 'HUF', 'VND', 'CLP', 'TWD']);

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/** Symbol for a currency code; unknown codes fall back to the code + nbsp (e.g. "CAD 12.00"). */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

/** Price with its currency symbol and grouped thousands, e.g. "$1,234.56", "¥1,200". */
export function formatPrice(value: number, currency: string, decimals?: number): string {
  const fixed = value.toFixed(decimals ?? currencyDecimals(currency));
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currencySymbol(currency)}${frac !== undefined ? `${grouped}.${frac}` : grouped}`;
}

/** `formatPrice` when the currency is known; a bare 2-dp number while it loads. */
export function formatPriceMaybe(value: number, currency: string | undefined): string {
  return currency ? formatPrice(value, currency) : value.toFixed(2);
}
