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
