// Series math replicating pandas semantics, so on-device indicator values match
// Fibenchi's backend (which uses pandas). Inputs are assumed finite (closes);
// the NaN-weighting edge cases pandas handles don't arise for our series.

/**
 * Exponentially weighted mean with `adjust=False` (pandas default recursion):
 * y[0] = x[0]; y[t] = (1 - alpha) * y[t-1] + alpha * x[t].
 * Outputs before `minPeriods` observations are masked to null, matching
 * pandas `ewm(min_periods=...)`.
 */
export function ewm(values: number[], alpha: number, minPeriods: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let prev = 0;
  let started = false;
  for (let i = 0; i < values.length; i++) {
    const x = values[i];
    if (!started) {
      prev = x;
      started = true;
    } else {
      prev = (1 - alpha) * prev + alpha * x;
    }
    if (i >= minPeriods - 1) out[i] = prev;
  }
  return out;
}

/** EMA over `span` with adjust=False, i.e. alpha = 2 / (span + 1). Defined from index 0. */
export function ema(values: number[], span: number): (number | null)[] {
  return ewm(values, 2 / (span + 1), 1);
}

/** Simple moving average; null until `period` observations (pandas rolling default). */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * RSI via Wilder's smoothing — `ewm(alpha=1/period, adjust=False, min_periods=period)`
 * of average gains/losses. Mirrors Fibenchi's `rsi()` exactly.
 */
export function rsi(closes: number[], period = 14): (number | null)[] {
  const n = closes.length;
  const gain = new Array(n).fill(0);
  const loss = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gain[i] = delta;
    else if (delta < 0) loss[i] = -delta;
  }
  const avgGain = ewm(gain, 1 / period, period);
  const avgLoss = ewm(loss, 1 / period, period);

  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (g === null || l === null) continue;
    if (l === 0) {
      out[i] = g === 0 ? null : 100; // all-gains window → RSI 100; flat → undefined
      continue;
    }
    const rs = g / l;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

/**
 * Exponentially weighted mean over a series with holes — pandas
 * `ewm(alpha, adjust=False, ignore_na=False).mean()`.
 *
 * The plain `ewm` above assumes finite inputs; σ-Move deliberately punches
 * `null`s into its return series (gap-spanning returns are dropped, not zeroed),
 * and pandas' handling of those is load-bearing:
 *
 * - a `null` input **decays** the average without contributing to it
 *   (`ignore_na=False`), so a hole ages the older observations — roughly one
 *   extra decay step for the missing stretch;
 * - the output at a `null` input is the previous value carried forward, not
 *   `null`;
 * - output is `null` only before the first observation.
 */
export function ewmWithHoles(values: (number | null)[], alpha: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let weighted: number | null = null;
  let oldWeight = 1;
  for (let i = 0; i < values.length; i++) {
    const x = values[i];
    if (weighted !== null) {
      oldWeight *= 1 - alpha;
      if (x !== null) {
        // Skip the update on an exactly-equal value, as pandas does, to avoid
        // drifting off a constant series through rounding.
        if (weighted !== x) {
          weighted = (oldWeight * weighted + alpha * x) / (oldWeight + alpha);
        }
        oldWeight = 1; // adjust=False
      }
    } else if (x !== null) {
      weighted = x;
    }
    out[i] = weighted;
  }
  return out;
}

/** Epoch seconds → whole UTC days, matching the backend's `datetime64[D]` cast. */
function utcDay(seconds: number): number {
  return Math.floor(seconds / 86400);
}

/** Business days in `[from, to)` — `np.busday_count`, Mon–Fri, holidays unknown. */
function busdayCount(from: number, to: number): number {
  if (to <= from) return 0;
  // Day 0 (1970-01-01) was a Thursday, so with Monday = 0 the weekday of a day
  // number is (day + 3) % 7 — i.e. 5 = Saturday, 6 = Sunday.
  const weeks = Math.floor((to - from) / 7);
  let count = weeks * 5;
  for (let day = from + weeks * 7; day < to; day++) {
    const weekday = (day + 3) % 7;
    if (weekday !== 5 && weekday !== 6) count++;
  }
  return count;
}

/**
 * Sessions elapsed between each bar and the previous one — Fibenchi's
 * `session_gap_days` in its **business-day fallback** mode. 1 means adjacent
 * sessions; >1 means at least one session in between has no bar.
 *
 * The app has no venue calendar (that lives in Fibenchi's `market_calendar`), so
 * exchange holidays are indistinguishable from feed holes and the bar after a
 * holiday reads as a gap. That's the conservative direction, and the same
 * fallback the backend takes when it has no session set: callers must read >1 as
 * "this is not a verified single-session step", not as proof of a data error.
 *
 * The first bar is `null` — no gap information — which callers treat as
 * contiguous. Daily bar timestamps are the session open in exchange-local time,
 * whose UTC date coincides with the local one for every venue in the book
 * (Tokyo's 09:00 JST daily stamp is 00:00 UTC of the same date); venues east of
 * ~UTC+11 would need the `gmtoffset` from `meta` to stay exact.
 */
export function sessionGapDays(times: number[]): (number | null)[] {
  const out: (number | null)[] = new Array(times.length).fill(null);
  for (let i = 1; i < times.length; i++) {
    out[i] = busdayCount(utcDay(times[i - 1]), utcDay(times[i]));
  }
  return out;
}

/** True when a gap value means "the previous bar is not the previous session". */
function isGap(gapSessions: (number | null)[] | undefined, i: number): boolean {
  const gap = gapSessions?.[i];
  return gap !== null && gap !== undefined && gap > 1;
}

/** Close-to-close simple returns; index 0 is null (pandas `pct_change`). */
function pctChange(closes: number[]): (number | null)[] {
  return closes.map((close, i) =>
    i === 0 || closes[i - 1] === 0 ? null : close / closes[i - 1] - 1
  );
}

export interface SigmaMoveSeries {
  /** σ-Move: the day's return in units of the vol forecast made before it. */
  vnr: (number | null)[];
  /**
   * Forward EWMA vol forecast built from returns *through* each bar — i.e. the
   * denominator for the *next* bar. The value on the last bar is the forecast
   * for the in-progress day, which is how a live intraday return gets scored
   * before its daily bar is written.
   */
  vnrSigma: (number | null)[];
  /** Gap width on bars the guard suppressed; null everywhere else. */
  vnrGapSessions: (number | null)[];
}

/**
 * σ-Move — a day's close-to-close return over a RiskMetrics zero-mean EWMA vol
 * forecast (λ = 0.94 ≈ 11-day half-life). Mirrors Fibenchi's
 * `volatility_normalized_return`.
 *
 * The forecast is built from returns **through the previous day** (`shift(1)`),
 * so a large move can't deflate its own score. Unlike a fixed rolling window an
 * EWMA has no hard edge, so an old shock decays smoothly instead of dropping out
 * and stepping the score.
 *
 * Gap guard: returns are positional, so a "daily" return spanning an N-session
 * hole is ~√N inflated against a one-day denominator. Those bars are reported as
 * null rather than as a fabricated single-day figure, and are also kept out of
 * the EWMA variance — squaring a √N-inflated return into it would overstate σ
 * for weeks, *understating* every σ-Move after the gap.
 */
export function volatilityNormalizedReturn(
  closes: number[],
  lam: number,
  gapSessions?: (number | null)[]
): SigmaMoveSeries {
  const returns = pctChange(closes);
  const squared = returns.map((r, i) => (r === null || isGap(gapSessions, i) ? null : r * r));
  const variance = ewmWithHoles(squared, 1 - lam);
  const vnrSigma = variance.map((v) => (v === null || v <= 0 ? null : Math.sqrt(v)));

  const vnr = closes.map((_, i) => {
    const forecast = i > 0 ? vnrSigma[i - 1] : null;
    const r = returns[i];
    if (r === null || forecast === null || isGap(gapSessions, i)) return null;
    return r / forecast;
  });

  return {
    vnr,
    vnrSigma,
    vnrGapSessions: closes.map((_, i) => (isGap(gapSessions, i) ? gapSessions![i] : null)),
  };
}

export interface MacdSeries {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
}

/** MACD line, signal line, histogram (defaults 12/26/9). Mirrors Fibenchi's `macd()`. */
export function macd(closes: number[], fast = 12, slow = 26, signal = 9): MacdSeries {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = closes.map((_, i) => (emaFast[i] as number) - (emaSlow[i] as number));
  const signalLine = ema(macdLine, signal);
  const hist: (number | null)[] = macdLine.map((m, i) =>
    signalLine[i] === null ? null : m - (signalLine[i] as number)
  );
  return { macd: macdLine, signal: signalLine, hist };
}
