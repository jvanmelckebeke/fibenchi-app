import type { MoverWindow } from '@/lib/movers';

// The move bars' scale: how unusual a 1wk/2wk/1mo move is in size for this
// symbol. Fibenchi computes each symbol's own distribution of absolute window
// returns (52 weeks for 1wk and 2wk, 2 years for 1mo) and ships it as 21
// quantiles in the pulse bundle; the app only places the live move on them,
// the same mapping fibenchi's web board uses.

export interface MoveScale {
  /** Absolute window returns in percent at p = 0, 5, …, 100, ascending. */
  quantiles: number[];
  samples: number;
  lookbackDays: number;
}

/** Per window; null when the symbol has too little history for one. */
export type MoveScales = Record<MoverWindow, MoveScale | null>;

/**
 * The share of this symbol's own moves for the window that were smaller than
 * `pct`, from 0 to 1: the position of |pct| on the piecewise-linear curve
 * through (quantile i, i x 5%). Null without a scale or a move.
 */
export function movePercentile(pct: number | null, scale: MoveScale | null): number | null {
  if (pct === null || !scale || scale.quantiles.length < 2) return null;
  const q = scale.quantiles;
  const v = Math.abs(pct);
  const last = q.length - 1;
  if (v < q[0]) return 0;
  if (v >= q[last]) return 1;
  // The last index whose quantile is <= v: equal neighbours resolve upward.
  let i = 0;
  while (i < last && q[i + 1] <= v) i++;
  const span = q[i + 1] - q[i];
  const within = span > 0 ? (v - q[i]) / span : 0;
  return (i + within) / last;
}
