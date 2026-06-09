import type { IntradayResult, MarketState, OhlcBar, Quote } from '../types';

// Boundary validation, hand-rolled (no Zod). Yahoo's unofficial JSON is messy —
// null rows, missing fields, occasional shape changes — so parse defensively
// here and let internal code trust the typed result.

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
  const price = num(meta.regularMarketPrice);
  const previousClose = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  if (symbol === null || price === null || previousClose === null) {
    throw new Error('yahoo: quote missing symbol/price/previousClose');
  }
  const change = price - previousClose;
  const marketState = deriveMarketState(meta);
  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent: previousClose !== 0 ? (change / previousClose) * 100 : 0,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    currency: str(meta.currency),
    shortName: str(meta.shortName) ?? str(meta.longName),
    marketState,
    isOpen: deriveIsOpen(meta, marketState),
    marketTime: num(meta.regularMarketTime) ?? Math.floor(Date.now() / 1000),
  };
}

/** OHLC bars (daily or intraday) from a chart response, skipping null rows. */
export function parseBars(json: unknown): OhlcBar[] {
  const result = chartResult(json);
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
    const close = num(closes[i]);
    // Yahoo emits null rows (holidays, gaps, the forming bar) — skip incomplete ones.
    if (time === null || close === null) continue;
    bars.push({
      time,
      open: num(opens[i]) ?? close,
      high: num(highs[i]) ?? close,
      low: num(lows[i]) ?? close,
      close,
      adjClose: num(adjcloses[i]),
      volume: num(volumes[i]),
    });
  }
  return bars;
}

/** Today's intraday trajectory (close per minute) + the prior-close baseline. */
export function parseIntraday(json: unknown): IntradayResult {
  const meta = asRecord(chartResult(json).meta);
  const previousClose = num(meta.previousClose) ?? num(meta.chartPreviousClose) ?? 0;
  const symbol = str(meta.symbol) ?? '';
  const points = parseBars(json).map((bar) => ({ time: bar.time, price: bar.close }));
  return { symbol, previousClose, points };
}
