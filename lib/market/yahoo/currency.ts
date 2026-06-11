// Currency resolution for Yahoo data. Ported from Fibenchi's backend
// (`services/yahoo/currency.py` + `services/currency_service.py`). Fibenchi
// normalizes prices in a backend pipeline; this app talks to Yahoo directly, so
// the same `(displayCode, divisor)` resolution happens here at the parse
// boundary and the divisor is applied to prices in `parse.ts`.

/**
 * Currencies Yahoo quotes in a 1/100 subunit: London pence (`GBp`/`GBX`),
 * Israeli agorot (`ILA`), South African cents (`ZAc`). Yahoo reports e.g. a
 * London listing as `GBp` priced in pence — we map to the major unit (`GBP`)
 * and divide by 100 so a £50 stock reads £50, not 5000. Keys are matched
 * case-sensitively *before* upcasing, since `GBp` (pence) and `GBP` (pounds)
 * differ only by case.
 */
const SUBUNIT: Record<string, { code: string; divisor: number }> = {
  GBp: { code: 'GBP', divisor: 100 },
  GBX: { code: 'GBP', divisor: 100 },
  ILA: { code: 'ILS', divisor: 100 },
  ZAc: { code: 'ZAR', divisor: 100 },
};

/**
 * Fallback from a Yahoo exchange suffix to an ISO 4217 code, used only when
 * `meta.currency` is absent. Ported from Fibenchi's `EXCHANGE_CURRENCY_MAP`.
 */
const EXCHANGE_CURRENCY: Record<string, string> = {
  // Asia-Pacific
  '.KS': 'KRW', // Korea (KOSPI)
  '.KQ': 'KRW', // Korea (KOSDAQ)
  '.T': 'JPY', // Tokyo
  '.HK': 'HKD', // Hong Kong
  '.SS': 'CNY', // Shanghai
  '.SZ': 'CNY', // Shenzhen
  '.TW': 'TWD', // Taiwan (TWSE)
  '.TWO': 'TWD', // Taiwan (OTC)
  '.SI': 'SGD', // Singapore
  '.AX': 'AUD', // Australia (ASX)
  '.NZ': 'NZD', // New Zealand
  '.NS': 'INR', // India (NSE)
  '.BO': 'INR', // India (BSE)
  '.JK': 'IDR', // Jakarta
  '.BK': 'THB', // Bangkok
  // Europe
  '.L': 'GBP', // London
  '.IL': 'GBP', // London (IOB)
  '.PA': 'EUR', // Paris
  '.DE': 'EUR', // XETRA (Germany)
  '.F': 'EUR', // Frankfurt
  '.MI': 'EUR', // Milan
  '.MC': 'EUR', // Madrid
  '.AS': 'EUR', // Amsterdam
  '.BR': 'EUR', // Brussels
  '.LS': 'EUR', // Lisbon
  '.HE': 'EUR', // Helsinki
  '.AT': 'EUR', // Athens
  '.VI': 'EUR', // Vienna
  '.IR': 'EUR', // Dublin
  '.OL': 'NOK', // Oslo
  '.ST': 'SEK', // Stockholm
  '.CO': 'DKK', // Copenhagen
  '.IC': 'ISK', // Iceland
  '.WA': 'PLN', // Warsaw
  '.PR': 'CZK', // Prague
  '.BD': 'HUF', // Budapest
  '.SW': 'CHF', // Swiss Exchange
  '.IS': 'TRY', // Istanbul
  // Middle East & Africa
  '.TA': 'ILS', // Tel Aviv
  '.SR': 'SAR', // Saudi (Tadawul)
  '.QA': 'QAR', // Qatar
  '.JO': 'ZAR', // Johannesburg
  // Americas
  '.TO': 'CAD', // Toronto (TSX)
  '.V': 'CAD', // TSX Venture
  '.SA': 'BRL', // Sao Paulo
  '.MX': 'MXN', // Mexico
  '.SN': 'CLP', // Santiago
  '.BA': 'ARS', // Buenos Aires
};

export interface ResolvedCurrency {
  /** ISO 4217 display code in the major unit (e.g. `GBP`, never `GBp`). */
  code: string;
  /** Divide raw Yahoo prices by this to reach the major unit (1 unless a subunit). */
  divisor: number;
}

/** Derive a currency from a symbol's exchange suffix (e.g. `.L` → `GBP`). */
function fromSuffix(symbol: string): string | null {
  const dot = symbol.lastIndexOf('.');
  if (dot === -1) return null;
  return EXCHANGE_CURRENCY[symbol.slice(dot).toUpperCase()] ?? null;
}

/**
 * Resolve the display currency + subunit divisor for a Yahoo symbol, mirroring
 * Fibenchi's chain: raw `meta.currency` (subunit-normalized) → exchange-suffix
 * fallback → USD default. The divisor handles the pence/agorot/cents that Yahoo
 * quotes in 1/100 units.
 */
export function resolveCurrency(raw: string | null, symbol: string): ResolvedCurrency {
  if (raw) {
    const sub = SUBUNIT[raw];
    if (sub) return sub;
    return { code: raw.toUpperCase(), divisor: 1 };
  }
  const suffix = fromSuffix(symbol);
  if (suffix) return { code: suffix, divisor: 1 };
  return { code: 'USD', divisor: 1 };
}
