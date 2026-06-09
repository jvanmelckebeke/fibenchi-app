import type { ThemePalette } from '@/lib/theme';

// Shared display helpers for the app's core glance semantics — signed numbers,
// signed percents, and the gain/loss/flat colour mapping. These were duplicated
// across the ticker card, asset detail, movement grid and intraday readout;
// keeping them here means "what counts as up" and "how a percent reads" are
// decided in one place.

/** Direction of a numeric change. Exactly zero is `flat` (its own colour). */
export type Trend = 'up' | 'down' | 'flat';

export function trend(value: number): Trend {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

/** Finance colour for a change: gain (up) / loss (down) / flat (unchanged). */
export function trendColor(value: number, theme: ThemePalette): string {
  switch (trend(value)) {
    case 'up':
      return theme.gain;
    case 'down':
      return theme.loss;
    case 'flat':
      return theme.flat;
  }
}

/** Signed number, e.g. "+1.23", "-0.50", "0.00" (no plus when flat/negative). */
export function signed(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

/** Signed percent, e.g. "+1.23%", "-0.50%", "0.00%". */
export function signedPercent(value: number, decimals = 2): string {
  return `${signed(value, decimals)}%`;
}
