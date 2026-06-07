import type { OhlcBar } from '@/lib/market';
import { macd, rsi, sma } from './series-math';

/** Per-symbol context the indicator functions read from (extend with highs/lows/volumes for OHLC indicators). */
interface SeriesCtx {
  closes: number[];
}

/**
 * Declarative indicator definition — data-driven registry (mirrors Fibenchi's
 * INDICATOR_REGISTRY). Adding an indicator is one entry here, not a new code path.
 * BB / ATR / ADX slot in later (they need highs/lows/volumes on SeriesCtx).
 */
interface IndicatorDef {
  key: string;
  compute: (ctx: SeriesCtx) => Record<string, (number | null)[]>;
  outputFields: string[];
  decimals: number;
  fieldDecimals?: Record<string, number>;
  /** Bars needed before the latest value is converged — drives history depth. */
  warmup: number;
  /** Derive snapshot-only fields (e.g. MACD direction) from the latest row. */
  snapshotDerived?: (latest: Record<string, number | null>) => Record<string, string | null>;
}

const INDICATOR_REGISTRY: IndicatorDef[] = [
  {
    key: 'rsi',
    compute: ({ closes }) => ({ rsi: rsi(closes, 14) }),
    outputFields: ['rsi'],
    decimals: 2,
    warmup: 14,
  },
  {
    key: 'sma_20',
    compute: ({ closes }) => ({ sma_20: sma(closes, 20) }),
    outputFields: ['sma_20'],
    decimals: 4,
    warmup: 20,
  },
  {
    key: 'sma_50',
    compute: ({ closes }) => ({ sma_50: sma(closes, 50) }),
    outputFields: ['sma_50'],
    decimals: 4,
    warmup: 50,
  },
  {
    key: 'macd',
    compute: ({ closes }) => {
      const m = macd(closes, 12, 26, 9);
      return { macd: m.macd, macd_signal: m.signal, macd_hist: m.hist };
    },
    outputFields: ['macd', 'macd_signal', 'macd_hist'],
    decimals: 4,
    warmup: 35,
    snapshotDerived: (latest) => {
      const line = latest.macd;
      const signal = latest.macd_signal;
      if (line === null || signal === null) return { macd_signal_dir: null };
      return { macd_signal_dir: line > signal ? 'bullish' : 'bearish' };
    },
  },
];

/** Max warmup across the registry — consumers fetch at least this many bars of history. */
export function getMaxWarmup(): number {
  return INDICATOR_REGISTRY.reduce((max, def) => Math.max(max, def.warmup), 0);
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
  for (const def of INDICATOR_REGISTRY) {
    const output = def.compute(ctx);
    for (const field of def.outputFields) {
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

  for (const def of INDICATOR_REGISTRY) {
    const latest: Record<string, number | null> = {};
    for (const field of def.outputFields) {
      const value = computed.fields[field]?.[n - 1] ?? null;
      latest[field] = value;
      values[field] = safeRound(value, def.fieldDecimals?.[field] ?? def.decimals);
    }
    if (def.snapshotDerived) {
      Object.assign(values, def.snapshotDerived(latest));
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

function safeRound(value: number | null, decimals: number): number | null {
  return value !== null && Number.isFinite(value) ? round(value, decimals) : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
