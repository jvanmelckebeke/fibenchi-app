import type {
  IntradayResult,
  MarketState,
  OhlcBar,
  Quote,
  SessionWindow,
  SymbolSearchResult,
} from '../types';
import { resolveCurrency } from './currency';

// Boundary validation, hand-rolled (no Zod). Yahoo's unofficial JSON is messy —
// null rows, missing fields, occasional shape changes — so parse defensively
// here and let internal code trust the typed result.
//
// Prices are also *normalized* here: Yahoo quotes some markets in a 1/100
// subunit (London pence, Tel Aviv agorot), so every price is divided by the
// resolved currency divisor at this boundary. Internal types are therefore
// always in the major unit, and the display layer only needs the symbol.

/** Divide a price by the subunit divisor, preserving null. */
function scale(value: number | null, divisor: number): number | null {
  return value === null ? null : value / divisor;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('yahoo: expected an object');
  }
  return value as Record<string, unknown>;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Extract the single chart result from a v8 chart response, or throw. */
function chartResult(json: unknown): Record<string, unknown> {
  const chart = asRecord(asRecord(json).chart);
  if (chart.error) {
    throw new Error(`yahoo: chart error ${JSON.stringify(chart.error)}`);
  }
  const result = arr(chart.result);
  if (result.length === 0) {
    throw new Error('yahoo: empty chart result');
  }
  return asRecord(result[0]);
}

/** Which session are we in, derived from meta.currentTradingPeriod windows. */
function deriveMarketState(meta: Record<string, unknown>): MarketState {
  const periods = meta.currentTradingPeriod;
  if (typeof periods !== 'object' || periods === null) {
    return 'closed';
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const inWindow = (key: string): boolean => {
    const window = (periods as Record<string, unknown>)[key];
    if (typeof window !== 'object' || window === null) return false;
    const start = num((window as Record<string, unknown>).start);
    const end = num((window as Record<string, unknown>).end);
    return start !== null && end !== null && nowSec >= start && nowSec < end;
  };
  if (inWindow('regular')) return 'regular';
  if (inWindow('pre')) return 'pre';
  if (inWindow('post')) return 'post';
  return 'closed';
}

/**
 * Is this symbol tradeable right now? Crypto trades 24/7 (flagged by Yahoo as
 * CRYPTOCURRENCY, not by guessing at the `-USD` suffix); everything else is open
 * only in its regular session — and `currentTradingPeriod` already carries each
 * exchange's local window, so EU listings (.MI/.L/…) resolve to EU hours for free.
 */
function deriveIsOpen(meta: Record<string, unknown>, state: MarketState): boolean {
  if (str(meta.instrumentType) === 'CRYPTOCURRENCY') return true;
  return state === 'regular';
}

/** Quote from the chart response's `meta` block. */
export function parseQuote(json: unknown): Quote {
  const meta = asRecord(chartResult(json).meta);
  const symbol = str(meta.symbol);
  const rawPrice = num(meta.regularMarketPrice);
  const rawPrevClose = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  if (symbol === null || rawPrice === null || rawPrevClose === null) {
    throw new Error('yahoo: quote missing symbol/price/previousClose');
  }
  // Resolve currency + subunit divisor, then normalize every price to the major
  // unit before deriving change (a ratio, so % is divisor-invariant either way).
  const { code, divisor } = resolveCurrency(str(meta.currency), symbol);
  const price = rawPrice / divisor;
  const previousClose = rawPrevClose / divisor;
  const change = price - previousClose;
  const marketState = deriveMarketState(meta);
  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent: previousClose !== 0 ? (change / previousClose) * 100 : 0,
    dayHigh: scale(num(meta.regularMarketDayHigh), divisor),
    dayLow: scale(num(meta.regularMarketDayLow), divisor),
    volume: num(meta.regularMarketVolume),
    currency: code,
    shortName: str(meta.shortName) ?? str(meta.longName),
    marketState,
    isOpen: deriveIsOpen(meta, marketState),
    marketTime: num(meta.regularMarketTime) ?? Math.floor(Date.now() / 1000),
    regularWindow: parseRegularWindow(meta),
  };
}

/** OHLC bars (daily or intraday) from a chart response, skipping null rows. */
export function parseBars(json: unknown): OhlcBar[] {
  const result = chartResult(json);
  const meta = asRecord(result.meta);
  const { divisor } = resolveCurrency(str(meta.currency), str(meta.symbol) ?? '');
  const timestamps = arr(result.timestamp);
  const indicators = asRecord(result.indicators);

  const quoteSeries = arr(indicators.quote);
  const ohlc = quoteSeries.length > 0 ? asRecord(quoteSeries[0]) : {};
  const opens = arr(ohlc.open);
  const highs = arr(ohlc.high);
  const lows = arr(ohlc.low);
  const closes = arr(ohlc.close);
  const volumes = arr(ohlc.volume);

  const adjSeries = arr(indicators.adjclose);
  const adjcloses = adjSeries.length > 0 ? arr(asRecord(adjSeries[0]).adjclose) : [];

  const bars: OhlcBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const time = num(timestamps[i]);
    const rawClose = num(closes[i]);
    // Yahoo emits null rows (holidays, gaps, the forming bar) — skip incomplete ones.
    if (time === null || rawClose === null) continue;
    // Normalize prices to the major unit (subunit markets quote in 1/100); volume
    // is a count, so it's left as-is.
    const close = rawClose / divisor;
    bars.push({
      time,
      open: (num(opens[i]) ?? rawClose) / divisor,
      high: (num(highs[i]) ?? rawClose) / divisor,
      low: (num(lows[i]) ?? rawClose) / divisor,
      close,
      adjClose: scale(num(adjcloses[i]), divisor),
      volume: num(volumes[i]),
    });
  }
  return bars;
}

/** The regular-session window from `meta.currentTradingPeriod`, or null. */
function parseRegularWindow(meta: Record<string, unknown>): SessionWindow | null {
  const periods = meta.currentTradingPeriod;
  if (typeof periods !== 'object' || periods === null) return null;
  const regular = (periods as Record<string, unknown>).regular;
  if (typeof regular !== 'object' || regular === null) return null;
  const start = num((regular as Record<string, unknown>).start);
  const end = num((regular as Record<string, unknown>).end);
  return start !== null && end !== null ? { start, end } : null;
}

/** Today's intraday trajectory (close per minute) + the prior-close baseline. */
export function parseIntraday(json: unknown): IntradayResult {
  const meta = asRecord(chartResult(json).meta);
  const symbol = str(meta.symbol) ?? '';
  const { divisor } = resolveCurrency(str(meta.currency), symbol);
  // `parseBars` already normalizes its points; only previousClose (read straight
  // from meta) needs the same divisor so the baseline matches the trajectory.
  const previousClose = (num(meta.previousClose) ?? num(meta.chartPreviousClose) ?? 0) / divisor;
  const points = parseBars(json).map((bar) => ({ time: bar.time, price: bar.close }));
  return { symbol, previousClose, points, regularWindow: parseRegularWindow(meta) };
}

/** Map Yahoo `quoteType` to our coarse asset type. */
function searchType(quoteType: string | null): SymbolSearchResult['type'] {
  switch (quoteType) {
    case 'EQUITY':
      return 'stock';
    case 'ETF':
      return 'etf';
    case 'INDEX':
      return 'index';
    default:
      return 'other';
  }
}

/**
 * Parse the v1 search payload into symbol hits. Keeps only tradeable instruments
 * (equity/ETF/index — drops currencies, futures, news); names fall back through
 * shortname → longname → symbol. `tracked` is decided by the caller.
 */
export function parseSearchResults(json: unknown): SymbolSearchResult[] {
  const quotes = arr(asRecord(json).quotes);
  const results: SymbolSearchResult[] = [];
  for (const raw of quotes) {
    const item = raw as Record<string, unknown>;
    const symbol = str(item.symbol);
    if (!symbol) continue;
    const quoteType = str(item.quoteType);
    if (quoteType !== 'EQUITY' && quoteType !== 'ETF' && quoteType !== 'INDEX') continue;
    results.push({
      symbol,
      name: str(item.shortname) ?? str(item.longname) ?? symbol,
      exchange: str(item.exchDisp) ?? str(item.exchange),
      type: searchType(quoteType),
      tracked: false,
    });
  }
  return results;
}
