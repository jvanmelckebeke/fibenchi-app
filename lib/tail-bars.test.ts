import { TAIL_BAR, TAIL_GAP, tailBarCount } from './tail-bars';

/** Track left for the bars on a 360dp phone: 360 − mx-4 − gap-3 − label. */
const PHONE_TRACK = 258;

/** Laid-out width of `count` full-size bars — what has to fit the track. */
function laidOutWidth(count: number) {
  return count === 0 ? 0 : count * TAIL_BAR + (count - 1) * TAIL_GAP;
}

describe('tailBarCount', () => {
  it('fills the track without overflowing it', () => {
    const drawn = tailBarCount(PHONE_TRACK, 71);
    expect(laidOutWidth(drawn)).toBeLessThanOrEqual(PHONE_TRACK);
    // and is genuinely full — one more bar would not fit
    expect(laidOutWidth(drawn + 1)).toBeGreaterThan(PHONE_TRACK);
  });

  it('never asks for more bars than the tail has', () => {
    expect(tailBarCount(PHONE_TRACK, 3)).toBe(3);
    expect(tailBarCount(PHONE_TRACK, 0)).toBe(0);
  });

  it('draws nothing before the track has been measured', () => {
    expect(tailBarCount(0, 71)).toBe(0);
  });

  it('scales with the track, so a wider screen shows more of the book', () => {
    expect(tailBarCount(520, 71)).toBeGreaterThan(tailBarCount(PHONE_TRACK, 71));
  });

  it('never overflows at any track width or book size', () => {
    for (let track = 40; track <= 900; track += 7) {
      for (const available of [1, 5, 20, 71, 400]) {
        expect(laidOutWidth(tailBarCount(track, available))).toBeLessThanOrEqual(track);
      }
    }
  });
});
