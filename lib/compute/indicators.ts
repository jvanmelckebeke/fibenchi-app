import type { OhlcBar, Period } from '@/lib/market';
import { INDICATOR_SPECS, type IndicatorSpec } from './generated/registry';
import { macd, rsi, sma } from './series-math';

/** Per-symbol context the kernels read from (extend with highs/lows/volumes for OHLC indicators). */
interface SeriesCtx {
  closes: number[];
}

/** A numeric kernel: maps the series context + its spec to its output field series. */
type Kernel = (ctx: SeriesCtx, spec: IndicatorSpec) => Record<string, (number | null)[]>;

/**
 * Hand-written numeric kernels, dispatched by the `kernel` id in the *generated*
 * registry (`generated/registry.ts`, emitted from Fibenchi's contract). The
 * registry metadata — which indicators, params, warmup, decimals — is generated
 * so it can't drift from the backend; the math lives here and is pinned to the
 * pandas reference by the golden test (see `indicators.test.ts`). Promoting a
 * web-only indicator to the app = one `platforms` flag upstream + a kernel here.
 */
const KERNELS: Record<string, Kernel> = {
  rsi: ({ closes }, spec) => ({ [spec.outputFields[0]]: rsi(closes, spec.params.period) }),
  sma: ({ closes }, spec) => ({ [spec.outputFields[0]]: sma(closes, spec.params.period) }),
  macd: ({ closes }, spec) => {
    const m = macd(closes, spec.params.fast, spec.params.slow, spec.params.signal);
    return { macd: m.macd, macd_signal: m.signal, macd_hist: m.hist };
  },
};

/** Snapshot-only derived fields (e.g. MACD direction), dispatched by the `snapshotDerived` tag. */
const SNAPSHOT_DERIVED: Record<
  string,
  (latest: Record<string, number | null>) => Record<string, string | null>
> = {
  macd: (latest) => {
    const line = latest.macd;
    const signal = latest.macd_signal;
    if (line === null || signal === null) return { macd_signal_dir: null };
    return { macd_signal_dir: line > signal ? 'bullish' : 'bearish' };
  },
};

/** Max warmup across the registry — consumers fetch at least this many bars of history. */
export function getMaxWarmup(): number {
  return INDICATOR_SPECS.reduce((max, spec) => Math.max(max, spec.warmup), 0);
}

/** Approx trading days per supported period (~21/month) — for sizing history fetches. */
const PERIOD_TRADING_DAYS: Record<Period, number> = {
  '1mo': 21,
  '3mo': 63,
  '6mo': 126,
  '1y': 252,
  '2y': 504,
  '5y': 1260,
};

/**
 * Smallest daily-history period that covers every indicator's warmup with room
 * to settle. `warmup` is the bars to *first defined*; we fetch ~2× that so the
 * EMA-based indicators (MACD/signal) are well past their seed, not barely
 * defined — and so SMA-50 actually resolves instead of returning null on a short
 * fetch. Derived from the registry: add a longer-warmup indicator and the
 * fetched history widens automatically, rather than silently dropping values.
 */
export function indicatorHistoryPeriod(): Period {
  const needed = getMaxWarmup() * 2;
  const order: Period[] = ['1mo', '3mo', '6mo', '1y', '2y', '5y'];
  return order.find((period) => PERIOD_TRADING_DAYS[period] >= needed) ?? '5y';
}

export interface ComputedIndicators {
  time: number[];
  close: number[];
  /** Field name → per-bar series (aligned to `time`). */
  fields: Record<string, (number | null)[]>;
}

/** Compute every registered indicator's full series from daily bars. */
export function computeIndicators(bars: OhlcBar[]): ComputedIndicators {
  const ctx: SeriesCtx = { closes: bars.map((b) => b.close) };
  const fields: Record<string, (number | null)[]> = {};
  for (const spec of INDICATOR_SPECS) {
    const kernel = KERNELS[spec.kernel];
    const output = kernel ? kernel(ctx, spec) : {};
    for (const field of spec.outputFields) {
      fields[field] = output[field] ?? new Array(bars.length).fill(null);
    }
  }
  return { time: bars.map((b) => b.time), close: ctx.closes, fields };
}

export interface IndicatorSnapshot {
  close: number;
  /** Latest day-over-day close change. */
  changePct: number | null;
  /** Latest value per indicator field, plus derived fields (e.g. macd_signal_dir). */
  values: Record<string, number | string | null>;
}

/**
 * Latest indicator values for the card/detail view (mirrors Fibenchi's
 * `build_indicator_snapshot`). Returns null with < 2 bars.
 */
export function buildIndicatorSnapshot(bars: OhlcBar[]): IndicatorSnapshot | null {
  if (bars.length < 2) return null;

  const computed = computeIndicators(bars);
  const n = bars.length;
  const values: Record<string, number | string | null> = {};

  for (const spec of INDICATOR_SPECS) {
    const latest: Record<string, number | null> = {};
    for (const field of spec.outputFields) {
      const value = computed.fields[field]?.[n - 1] ?? null;
      latest[field] = value;
      values[field] = safeRound(value, spec.fieldDecimals[field] ?? spec.decimals);
    }
    const derive = spec.snapshotDerived ? SNAPSHOT_DERIVED[spec.snapshotDerived] : undefined;
    if (derive) {
      Object.assign(values, derive(latest));
    }
  }

  const close = bars[n - 1].close;
  const prevClose = bars[n - 2].close;
  return {
    close: round(close, 2),
    changePct: prevClose !== 0 ? round((close - prevClose) / prevClose * 100, 2) : null,
    values,
  };
}

/** One bar of the MACD sub-series — line, signal, histogram — for the MACD chart. */
export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  hist: number;
}

/**
 * The last `count` *converged* bars of MACD line / signal / histogram, for the
 * swipe-to-reveal MACD chart. `computeIndicators` already produces the full
 * per-bar series, so this just drops warmup rows (where macd/signal are still
 * null) and trims to the requested window (~21 ≈ one trading month).
 */
export function macdSeries(bars: OhlcBar[], count = 21): MacdPoint[] {
  const { time, fields } = computeIndicators(bars);
  const macdLine = fields.macd ?? [];
  const signalLine = fields.macd_signal ?? [];
  const histLine = fields.macd_hist ?? [];

  const rows: MacdPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    const macd = macdLine[i];
    const signal = signalLine[i];
    const hist = histLine[i];
    if (macd == null || signal == null || hist == null) continue;
    rows.push({ time: time[i], macd, signal, hist });
  }
  return rows.slice(-count);
}

function safeRound(value: number | null, decimals: number): number | null {
  return value !== null && Number.isFinite(value) ? round(value, decimals) : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
