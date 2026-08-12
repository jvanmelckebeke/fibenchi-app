// The σ chip's diverging ramp. Seven classes, two opposed hues, a neutral grey
// midpoint — never a hue in the middle, so "unremarkable" doesn't read as a weak
// signal in either direction.
//
// The hues are the app's *own* finance colours (theme.gain H 149.6 / theme.loss
// H 24.7 in OKLCH), not a stock diverging palette, so the phone doesn't end up
// carrying two different greens. Lightness is monotone per arm with ΔL >= 0.064,
// and #fafafa clears 4.5:1 on every step — which is what lets the chip's label
// stay one colour instead of flipping to dark on the light end.

/** Chip fill per σ class, from ≤-3σ to ≥+3σ. */
const RAMP = [
  '#b1413f', // <= -3
  '#8f3b38', // -3..-2
  '#6b3532', // -2..-1
  '#323235', // -1..+1
  '#245330', // +1..+2
  '#196b34', // +2..+3
  '#048239', // >= +3
] as const;

/** Label colour that clears 4.5:1 on every step of the ramp. */
export const SIGMA_LABEL = '#fafafa';

/** Full-saturation rim for the extremes — the only place the ramp shouts. */
const RIM_UP = '#24c45e';
const RIM_DOWN = '#ed5351';

/** Class index 0-6 for a σ value. */
function rampIndex(sigma: number): number {
  if (sigma <= -3) return 0;
  if (sigma <= -2) return 1;
  if (sigma <= -1) return 2;
  if (sigma < 1) return 3;
  if (sigma < 2) return 4;
  if (sigma < 3) return 5;
  return 6;
}

export interface SigmaChipStyle {
  background: string;
  /** Set only at ±3σ and beyond — a 1px rim, the ramp's one loud note. */
  rim: string | null;
}

export function sigmaChipStyle(sigma: number): SigmaChipStyle {
  const background = RAMP[rampIndex(sigma)];
  const extreme = Math.abs(sigma) >= 3;
  return { background, rim: extreme ? (sigma > 0 ? RIM_UP : RIM_DOWN) : null };
}

/** Bar colour for one asset in the tail strip — same ramp, no rim. */
export function sigmaBarColor(sigma: number | null): string {
  return sigma === null ? RAMP[3] : RAMP[rampIndex(sigma)];
}

/** `+3.1σ` / `-0.4σ` — always signed, always one decimal. */
export function formatSigma(sigma: number): string {
  return `${sigma >= 0 ? '+' : '−'}${Math.abs(sigma).toFixed(1)}σ`;
}
