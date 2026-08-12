import type { OhlcBar, Period } from '@/lib/market';
import { INDICATOR_SPECS, type IndicatorSpec } from './generated/registry';
import { macd, rsi, sessionGapDays, sma, volatilityNormalizedReturn } from './series-math';

/** Per-symbol context the kernels read from (extend with highs/lows/volumes for OHLC indicators). */
interface SeriesCtx {
  closes: number[];
  /**
   * Sessions between each bar and the previous one, computed once here the way
   * the backend's `compute_indicators` owns a single gap series for every
   * gap-aware kernel.
   */
  gapSessions: (number | null)[];
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
 *
 * A kernel may emit **companion fields** beyond the spec's `outputFields` (the
 * σ-Move forecast and gap flag, which the backend post-computes rather than
 * returning from its kernel); `computeIndicators` keeps whatever it emits.
 */
const KERNELS: Record<string, Kernel> = {
  rsi: ({ closes }, spec) => ({ [spec.outputFields[0]]: rsi(closes, spec.params.period) }),
  sma: ({ closes }, spec) => ({ [spec.outputFields[0]]: sma(closes, spec.params.period) }),
  macd: ({ closes }, spec) => {
    const m = macd(closes, spec.params.fast, spec.params.slow, spec.params.signal);
    return { macd: m.macd, macd_signal: m.signal, macd_hist: m.hist };
  },
  volatility_normalized_return: ({ closes, gapSessions }, spec) => {
    const s = volatilityNormalizedReturn(closes, spec.params.lam, gapSessions);
    return { vnr: s.vnr, vnr_sigma: s.vnrSigma, vnr_gap_sessions: s.vnrGapSessions };
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
  const ctx: SeriesCtx = {
    closes: bars.map((b) => b.close),
    gapSessions: sessionGapDays(bars.map((b) => b.time)),
  };
  const fields: Record<string, (number | null)[]> = {};
  for (const spec of INDICATOR_SPECS) {
    const kernel = KERNELS[spec.kernel];
    const output = kernel ? kernel(ctx, spec) : {};
    for (const field of spec.outputFields) {
      fields[field] = output[field] ?? new Array(bars.length).fill(null);
    }
    // Companion fields the kernel emitted beyond the contract's outputFields.
    for (const [field, series] of Object.entries(output)) {
      fields[field] ??= series;
    }
  }
  return { time: bars.map((b) => b.time), close: ctx.closes, fields };
}

/**
 * Field → decimals, flattened from the registry once: a field's own override if
 * the contract carries one, else its indicator's default. Entries for fields the
 * app doesn't compute (the web-only `*_delta` analysis fields) are inert.
 */
const FIELD_DECIMALS: Record<string, number> = Object.fromEntries(
  INDICATOR_SPECS.flatMap((spec) => [
    ...spec.outputFields.map((field) => [field, spec.fieldDecimals[field] ?? spec.decimals]),
    ...Object.entries(spec.fieldDecimals),
  ])
);

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
  const latest: Record<string, number | null> = {};
  const values: Record<string, number | string | null> = {};

  for (const [field, series] of Object.entries(computed.fields)) {
    const value = series[n - 1] ?? null;
    latest[field] = value;
    values[field] = safeRound(value, FIELD_DECIMALS[field] ?? 4);
  }

  for (const spec of INDICATOR_SPECS) {
    const derive = spec.snapshotDerived ? SNAPSHOT_DERIVED[spec.snapshotDerived] : undefined;
    if (derive) Object.assign(values, derive(latest));
  }

  const close = bars[n - 1].close;
  const prevClose = bars[n - 2].close;
  // A gap-flagged latest bar means the previous *row* is not the previous
  // *session*: the difference would be a multi-session move mislabelled as a
  // day change. Left null, matching the suppressed σ-Move beside it.
  const spansGap = latest.vnr_gap_sessions !== null && latest.vnr_gap_sessions !== undefined;
  return {
    close: round(close, 2),
    changePct:
      prevClose !== 0 && !spansGap ? round(((close - prevClose) / prevClose) * 100, 2) : null,
    values,
  };
}

/** One bar of an indicator sub-series: `time` plus the requested fields, all converged. */
type IndicatorPoint<F extends string> = { time: number } & { [K in F]: number };

/**
 * The last `count` *converged* bars of the given indicator fields — the shared
 * recipe behind every reveal-chart series: compute over the full history
 * (correct EMA/Wilder convergence), drop rows where any requested field is
 * still in warmup, trim to the display window (~21 ≈ one trading month).
 * `fieldNames` are the registry's `outputFields`, verbatim — a new indicator
 * panel is one typed wrapper below, not another hand-rolled loop.
 */
function indicatorSeries<F extends string>(
  bars: OhlcBar[],
  fieldNames: readonly F[],
  count: number
): IndicatorPoint<F>[] {
  const { time, fields } = computeIndicators(bars);
  const rows: IndicatorPoint<F>[] = [];
  for (let i = 0; i < time.length; i++) {
    const row = { time: time[i] } as IndicatorPoint<F>;
    let converged = true;
    for (const name of fieldNames) {
      const value = fields[name]?.[i];
      if (value == null) {
        converged = false;
        break;
      }
      (row as Record<F, number>)[name] = value;
    }
    if (converged) rows.push(row);
  }
  return rows.slice(-count);
}

/** One bar of the MACD sub-series — field names match the contract registry. */
export interface MacdPoint {
  time: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
}

/** MACD line / signal / histogram for the swipe-to-reveal MACD chart. */
export function macdSeries(bars: OhlcBar[], count = 21): MacdPoint[] {
  return indicatorSeries(bars, ['macd', 'macd_signal', 'macd_hist'], count);
}

/** RSI zone — the 70/30 thresholds decided once, not per consumer. */
export type RsiZone = 'overbought' | 'oversold' | 'neutral';

export function rsiZone(rsi: number): RsiZone {
  if (rsi > 70) return 'overbought';
  if (rsi < 30) return 'oversold';
  return 'neutral';
}

/** One bar of the RSI sub-series — for the swipe-to-reveal RSI chart. */
export interface RsiPoint {
  time: number;
  rsi: number;
}

/** RSI trail for the swipe-right reveal chart. */
export function rsiSeries(bars: OhlcBar[], count = 21): RsiPoint[] {
  return indicatorSeries(bars, ['rsi'], count);
}

/** Sessions of returns σ-Move needs before it reports — the contract's warmup. */
export const SIGMA_MOVE_WARMUP = INDICATOR_SPECS.find((spec) => spec.key === 'vnr')?.warmup ?? 60;

/**
 * σ-Move for one symbol, or the reason there isn't one. The Pulse ranks on
 * `sigma` and explains the rest — so "no reading" is a value here, not a null
 * the UI has to interpret. There is deliberately **no fallback to a provisional
 * σ from a stale forecast**: an honest gap beats a plausible lie.
 *
 * - `scored` on `close` — the last daily bar's σ-Move.
 * - `scored` on `live` — today's in-progress return scored against the forecast
 *   built through the last completed session, which is how a move gets a σ
 *   before its daily bar is written. Pass `dayReturn` as a fraction
 *   (`price / previousClose - 1`) from the live quote.
 * - `gap` — the return spans a hole in the daily series.
 * - `warmup` — fewer than `SIGMA_MOVE_WARMUP` usable returns.
 */
export type SigmaMove =
  | { kind: 'scored'; sigma: number; basis: 'live' | 'close' }
  | { kind: 'gap'; sessions: number }
  | { kind: 'warmup'; returns: number; needed: number };

export function sigmaMove(bars: OhlcBar[], dayReturn?: number | null): SigmaMove {
  const { fields } = computeIndicators(bars);
  const n = bars.length;
  const usableReturns = (fields.vnr_sigma ?? []).filter((v) => v !== null).length;
  if (usableReturns < SIGMA_MOVE_WARMUP) {
    return { kind: 'warmup', returns: usableReturns, needed: SIGMA_MOVE_WARMUP };
  }

  const gapSessions = fields.vnr_gap_sessions?.[n - 1] ?? null;
  if (gapSessions !== null) return { kind: 'gap', sessions: gapSessions };

  // Live basis: the forecast on the last completed bar is the one made *for*
  // the in-progress day, so today's return divides by it directly.
  const forecast = fields.vnr_sigma?.[n - 1] ?? null;
  if (dayReturn !== null && dayReturn !== undefined && forecast !== null) {
    return { kind: 'scored', sigma: dayReturn / forecast, basis: 'live' };
  }

  const latest = fields.vnr?.[n - 1] ?? null;
  if (latest !== null) return { kind: 'scored', sigma: latest, basis: 'close' };
  return { kind: 'warmup', returns: usableReturns, needed: SIGMA_MOVE_WARMUP };
}

function safeRound(value: number | null, decimals: number): number | null {
  return value !== null && Number.isFinite(value) ? round(value, decimals) : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
