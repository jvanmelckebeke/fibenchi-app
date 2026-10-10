// The Board's diverging colour ramp and its scaling rules, ported from Fibenchi
// web's `pages/portfolio/board/color-scale.ts` so a tile on the phone wears the
// colour the same tile wears on the laptop.
//
// It is a different ramp from the Pulse chip's (`sigma-ramp.ts`) on purpose.
// The chip is seven classes, because five rows are read one at a time; the
// board is a field of ~90 tiles read as a whole, where ±0.7σ against ±0.8σ
// should differ by a shade rather than a cliff. Tiles with no reading are not
// on this ramp at all: unknown must never render as calm.

/** Gradient stops at -3 … +3 (×unit): deep red → neutral grey → bright green. */
export const RAMP_COLORS = [
  '#7f1d2b',
  '#a8323f',
  '#c2666e',
  '#3b3b40',
  '#4f8f6d',
  '#3fa878',
  '#2fc98a',
] as const;

export type ColorMode = 'sigma' | 'pct';

// The day-adaptive scales below may only tighten over a board that was
// actually read. A partial set can only ever over-tighten (the max over a
// subset never exceeds the max over the whole), so below this coverage the
// scale stays at its canonical width. The web board's observed collapses sat
// at 0.74 and 0.45 coverage against a normal 77 of 78.
const TIGHTENING_COVERAGE = 0.9;

export function hasTighteningCoverage(resolved: number, total: number): boolean {
  return resolved > 0 && resolved >= total * TIGHTENING_COVERAGE;
}

/**
 * σ-mode ramp unit adapted to the day's spread: on a quiet day the scale
 * tightens so relative outliers still get colour, but never below a ±1.5σ full
 * range and never looser than the canonical ±3σ.
 */
export function sigmaUnit(sigmas: number[], total: number): number {
  if (!hasTighteningCoverage(sigmas.length, total)) return 1;
  const maxAbs = Math.max(...sigmas.map(Math.abs));
  return Math.min(1, Math.max(0.5, maxAbs / 3));
}

/** %-mode span: the day's biggest move, clamped to ±2% … ±7%. */
export function pctSpan(pcts: number[], total: number): number {
  if (!hasTighteningCoverage(pcts.length, total)) return 7;
  const maxAbs = Math.max(...pcts.map(Math.abs));
  return Math.min(7, Math.max(2, maxAbs));
}

/**
 * The one span the whole board paints on, over every tile (filtered or not),
 * so a section and the Open filter never change a tile's colour. `readings`
 * holds the tiles that have a value in this mode; `total` counts all of them.
 */
export function boardSpan(readings: number[], total: number, mode: ColorMode): number {
  return mode === 'sigma' ? 3 * sigmaUnit(readings, total) : pctSpan(readings, total);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Dark ink on light fills, white elsewhere — web's `readableTextColor`. */
function readableTextColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1e293b' : '#ffffff';
}

/** A value's tile colour and legible ink, interpolated along the ramp across ±span. */
export function rampColor(value: number, span: number): { color: string; ink: string } {
  const t = Math.max(-1, Math.min(1, span === 0 ? 0 : value / span));
  const p = (t + 1) * ((RAMP_COLORS.length - 1) / 2);
  const i = Math.min(RAMP_COLORS.length - 2, Math.floor(p));
  const color = lerpHex(RAMP_COLORS[i], RAMP_COLORS[i + 1], p - i);
  return { color, ink: readableTextColor(color) };
}
