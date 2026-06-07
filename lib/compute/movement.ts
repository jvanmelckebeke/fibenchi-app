import type { OhlcBar } from '@/lib/market';

interface DailyExtreme {
  /** Close-to-close percentage change for the day. */
  pct: number;
  /** Epoch seconds of the day the move occurred. */
  time: number;
}

interface Drawdown {
  /** Peak-to-trough decline as a (negative) percentage. */
  pct: number;
  /** Epoch seconds of the running peak the decline measured from. */
  peakTime: number;
  /** Epoch seconds of the trough (the lowest close after that peak). */
  troughTime: number;
}

export interface MovementStats {
  /** Total return from the first close in the window to the latest close, as a percentage. */
  periodReturnPct: number;
  /** First close in the window (baseline for the period return). */
  startClose: number;
  /** Latest close in the window. */
  endClose: number;
  /** Largest single-day gain (close-to-close). Null only when there are no day-over-day transitions. */
  maxDailyGain: DailyExtreme | null;
  /** Largest single-day loss (close-to-close); `pct` is negative for a genuine loss. */
  maxDailyLoss: DailyExtreme | null;
  /** Largest peak-to-trough decline over the window. Null when the close never fell below a running peak. */
  maxDrawdown: Drawdown | null;
  /** Count of days that closed higher than the previous close. */
  upDays: number;
  /** Count of days that closed lower than the previous close. */
  downDays: number;
  /** Number of day-over-day transitions considered (bars.length - 1). */
  tradingDays: number;
}

/**
 * Derive period movement and downside metrics from a daily OHLC series.
 *
 * Ported from Fibenchi's `movement-stats.ts` (dates → epoch `time`). Pure and
 * side-effect-free — operates only on the passed `bars` (assumed ascending by
 * time). Returns null when there is too little data (< 2 points) or the
 * baseline close is invalid.
 *
 * Note: "max daily move" (single-day, close-to-close) and "max drawdown"
 * (path-dependent peak-to-trough) are distinct metrics; both are reported.
 */
export function computeMovementStats(bars: OhlcBar[]): MovementStats | null {
  if (bars.length < 2) return null;

  const first = bars[0];
  const last = bars[bars.length - 1];
  if (first.close <= 0) return null;

  let maxDailyGain: DailyExtreme | null = null;
  let maxDailyLoss: DailyExtreme | null = null;
  let upDays = 0;
  let downDays = 0;

  // Running-peak drawdown: track the highest close seen so far and the largest
  // decline measured from it.
  let peak = first.close;
  let peakTime = first.time;
  let maxDrawdown: Drawdown | null = null;

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const { close: cur, time } = bars[i];

    if (prev > 0) {
      const dayPct = (cur / prev - 1) * 100;
      if (dayPct > 0) upDays++;
      else if (dayPct < 0) downDays++;
      if (maxDailyGain === null || dayPct > maxDailyGain.pct) maxDailyGain = { pct: dayPct, time };
      if (maxDailyLoss === null || dayPct < maxDailyLoss.pct) maxDailyLoss = { pct: dayPct, time };
    }

    if (cur > peak) {
      peak = cur;
      peakTime = time;
    } else if (peak > 0) {
      const ddPct = (cur / peak - 1) * 100;
      if (maxDrawdown === null || ddPct < maxDrawdown.pct) {
        maxDrawdown = { pct: ddPct, peakTime, troughTime: time };
      }
    }
  }

  return {
    periodReturnPct: (last.close / first.close - 1) * 100,
    startClose: first.close,
    endClose: last.close,
    maxDailyGain,
    maxDailyLoss,
    maxDrawdown,
    upDays,
    downDays,
    tradingDays: bars.length - 1,
  };
}
