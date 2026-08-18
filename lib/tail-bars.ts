/** The bar width the spec asks for. Bars are never drawn narrower than this. */
export const TAIL_BAR = 6;
/** Space between bars, so the tail reads as marks rather than a solid band. */
export const TAIL_GAP = 2;

/**
 * How many tail bars to draw in a `trackWidth`-wide track, out of `available`.
 *
 * The strip fills the track at full bar width and stops — it does not try to
 * represent every asset. Squeezing 71 bars into a phone width produced ~2.7px
 * slivers whose colour was the only thing left, and the bars that got sacrificed
 * to make room were the near-zero ones carrying no signal in the first place.
 * Since the tail arrives |σ|-desc, taking a prefix keeps the extremes and drops
 * the grey, with no threshold to tune.
 */
export function tailBarCount(trackWidth: number, available: number) {
  if (trackWidth <= 0) return 0;
  const fits = Math.floor((trackWidth + TAIL_GAP) / (TAIL_BAR + TAIL_GAP));
  return Math.max(0, Math.min(available, fits));
}
