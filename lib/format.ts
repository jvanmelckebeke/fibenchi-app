import type { MarketState } from '@/lib/market';
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

/**
 * Finance colour for a change: gain (up) / loss (down) / flat (unchanged).
 * A missing change (quote not loaded yet) reads as flat too.
 */
export function trendColor(value: number | null | undefined, theme: ThemePalette): string {
  if (value == null) return theme.flat;
  switch (trend(value)) {
    case 'up':
      return theme.gain;
    case 'down':
      return theme.loss;
    case 'flat':
      return theme.flat;
  }
}

/**
 * Label + session colour for an extended-hours session; null during regular
 * hours / closed (nothing to badge). The one place that decides what pre/post
 * are called and which Fibenchi session colour they wear — backs the detail
 * badge, the stat tiles and the sparkline tint.
 */
export function sessionBadge(
  state: MarketState | null | undefined,
  theme: ThemePalette
): { label: string; color: string } | null {
  if (state === 'pre') return { label: 'Pre-market', color: theme.marketPre };
  if (state === 'post') return { label: 'After-hours', color: theme.marketPost };
  return null;
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

// Currency display. Symbols/decimals + index/yield handling ported from
// Fibenchi's `lib/format.ts`. Prices are already normalized to the major unit at
// the market parse boundary (see `lib/market/yahoo/currency.ts`), so these only
// handle presentation.

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

// Yield indices read as a percentage, not a price (no currency symbol).
const YIELD_INDICES = new Set(['^TYX', '^TNX', '^FVX', '^IRX']);

/**
 * Everything needed to format a value for a given asset, bundled so it threads
 * through the UI as one prop instead of separate `currency` / `symbol` / type
 * args. Built once where the quote is in hand (`{ symbol, currency }`), then
 * passed along.
 */
export interface PriceFormat {
  /** Yahoo symbol — decides index vs priced, and the yield-index `%` suffix. */
  symbol: string;
  /** Resolved ISO 4217 code; undefined while the quote is still loading → bare number. */
  currency?: string;
}

/** Indices (Yahoo prefixes them with `^`) are point values, not currency amounts. */
function isIndex(symbol: string): boolean {
  return symbol.startsWith('^');
}

/** Group thousands with commas, e.g. "1234567.8" → "1,234,567.8". */
function groupThousands(fixed: string): string {
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}

export function currencyDecimals(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/** Symbol for a currency code; unknown codes fall back to the code + nbsp (e.g. "CAD 12.00"). */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

/**
 * Format a value for an asset, grouped by thousands. Indices render as a plain
 * point value (a currency symbol on an index is meaningless), with a `%` suffix
 * for yield indices (^TNX, …). Priced assets get their currency symbol; until
 * the quote — and thus the currency — loads, they fall back to a bare number.
 */
export function formatPrice(value: number, fmt: PriceFormat): string {
  if (isIndex(fmt.symbol)) {
    const body = groupThousands(value.toFixed(2));
    return YIELD_INDICES.has(fmt.symbol.toUpperCase()) ? `${body}%` : body;
  }
  if (!fmt.currency) return groupThousands(value.toFixed(2));
  return `${currencySymbol(fmt.currency)}${groupThousands(value.toFixed(currencyDecimals(fmt.currency)))}`;
}

/**
 * Compact, asset-aware price for large magnitudes — "$1.5M", "€2B". Indices and
 * sub-thousand values defer to `formatPrice`; the symbol is dropped while the
 * currency is unknown.
 */
export function formatCompactPrice(value: number, fmt: PriceFormat): string {
  const abs = Math.abs(value);
  if (isIndex(fmt.symbol) || abs < 1e3) return formatPrice(value, fmt);
  const sym = fmt.currency ? currencySymbol(fmt.currency) : '';
  const [divisor, suffix] = abs >= 1e9 ? [1e9, 'B'] : abs >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  let scaled = (value / divisor).toFixed(1);
  if (scaled.endsWith('.0')) scaled = scaled.slice(0, -2);
  return `${sym}${scaled}${suffix}`;
}
